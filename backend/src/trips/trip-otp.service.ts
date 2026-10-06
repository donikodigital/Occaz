// backend/src/trips/trip-otp.service.ts
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, OtpPurpose, TripStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OtpService } from '../otp/otp.service';
import { WalletsService } from '../wallets/wallets.service';

/**
 * [03/10/2026] v+ — Embarquement à une étape : un client qui monte en cours de route (Kindia, Mamou…) est pris en charge
 * pendant que le trajet est EN COURS, avec le même code ; un client qui monte au départ garde le parcours habituel
 * (conducteur arrivé au point de départ). Le code de dépose fonctionne partout, étape comprise.
 *
 * Section 17 : OTP départ (le passager donne le code au conducteur — sa
 * saisie confirme la prise en charge) puis OTP arrivée (confirme la fin
 * du trajet pour cette réservation). Un OTP est généré par Booking, pas
 * par TripPassenger individuel : les passagers d'une même réservation
 * voyagent ensemble et sont pris en charge/déposés comme un groupe.
 */
@Injectable()
export class TripOtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otpService: OtpService,
    private readonly wallets: WalletsService,
  ) {}

  private async getBookingWithContext(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { trip: true, customer: { include: { user: true } } },
    });
    if (!booking) throw new NotFoundException('Réservation introuvable.');
    return booking;
  }

  private assertDriverOwnsTrip(booking: { trip: { driverId: string } }, driverId: string) {
    if (booking.trip.driverId !== driverId) {
      throw new ForbiddenException("Cette réservation n'est pas rattachée à un de vos trajets.");
    }
  }

  /**
   * La prise en charge est possible quand le conducteur est au bon endroit : au point de départ (DRIVER_ARRIVED /
   * PASSENGER_PICKED_UP) pour un client qui monte au départ, en route (IN_PROGRESS) pour un client qui monte à une étape.
   */
  private isPickupWindowOpen(booking: { boardingStopId: string | null; trip: { status: TripStatus } }): boolean {
    if (booking.boardingStopId) return booking.trip.status === TripStatus.IN_PROGRESS;
    return booking.trip.status === TripStatus.DRIVER_ARRIVED || booking.trip.status === TripStatus.PASSENGER_PICKED_UP;
  }

  async requestPickupOtp(bookingId: string, driverId: string) {
    const booking = await this.getBookingWithContext(bookingId);
    this.assertDriverOwnsTrip(booking, driverId);
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(
        'Cette réservation doit être confirmée (paiement validé) avant la prise en charge.',
      );
    }
    if (!this.isPickupWindowOpen(booking)) {
      throw new BadRequestException(
        booking.boardingStopId
          ? 'Ce client monte à une étape : le code de prise en charge se demande pendant le trajet, une fois arrivé à son étape.'
          : "Signalez d'abord votre arrivée (markDriverArrived) avant de demander le code de prise en charge.",
      );
    }
    return this.otpService.generateAndSend(
      { purpose: OtpPurpose.TRIP_PICKUP, phone: booking.customer.user.phone, bookingId },
      'Communiquez ce code à votre conducteur pour confirmer votre prise en charge :',
    );
  }

  /**
   * Même code, déclenché cette fois par le passager lui-même (pas le
   * conducteur) — pour le retrouver dans l'app sans avoir à rouvrir le
   * SMS. Mêmes conditions que requestPickupOtp (réservation confirmée,
   * conducteur déjà arrivé) : le code n'a de sens qu'à ce moment-là.
   */
  async revealPickupOtpForCustomer(bookingId: string, customerId: string) {
    const booking = await this.getBookingWithContext(bookingId);
    if (booking.customerId !== customerId) {
      throw new ForbiddenException('Cette réservation ne vous appartient pas.');
    }
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(
        'Cette réservation doit être confirmée (paiement validé) avant la prise en charge.',
      );
    }
    if (!this.isPickupWindowOpen(booking)) {
      throw new BadRequestException(
        booking.boardingStopId
          ? "Ce code n'est disponible que lorsque le conducteur est arrivé à votre étape."
          : "Ce code n'est disponible que lorsque le conducteur est arrivé au point de départ.",
      );
    }
    return this.otpService.generateAndSend(
      { purpose: OtpPurpose.TRIP_PICKUP, phone: booking.customer.user.phone, bookingId },
      'Communiquez ce code à votre conducteur pour confirmer votre prise en charge :',
      { revealCodeToCaller: true },
    );
  }

  async verifyPickupOtp(bookingId: string, driverId: string, code: string) {
    const booking = await this.getBookingWithContext(bookingId);
    this.assertDriverOwnsTrip(booking, driverId);
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(
        'Cette réservation doit être confirmée (paiement validé) avant la prise en charge.',
      );
    }

    await this.otpService.verify({ purpose: OtpPurpose.TRIP_PICKUP, bookingId, code });
    await this.markPickedUp(booking);
  }

  /**
   * Validation manuelle par le support (jamais par le conducteur) — même
   * transition d'état que verifyPickupOtp, sans code : réservée aux
   * litiges où le passager reste injoignable ou refuse de communiquer
   * son code. Déclenchée uniquement via DisputesService.resolve (type
   * OTP_MANUAL_VALIDATION), jamais exposée directement au conducteur.
   */
  async manuallyValidatePickup(bookingId: string) {
    const booking = await this.getBookingWithContext(bookingId);
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(
        'Cette réservation doit être confirmée (paiement validé) avant la prise en charge.',
      );
    }
    await this.markPickedUp(booking);
  }

  private async markPickedUp(
    booking: Awaited<ReturnType<TripOtpService['getBookingWithContext']>>,
  ): Promise<void> {
    await this.prisma.tripPassenger.updateMany({
      where: { bookingId: booking.id },
      data: { pickedUpAt: new Date() },
    });

    if (booking.trip.status === TripStatus.DRIVER_ARRIVED) {
      await this.prisma.trip.update({
        where: { id: booking.tripId },
        data: { status: TripStatus.PASSENGER_PICKED_UP },
      });
    }

    // Le code de dépose est généré tout de suite : le client le reçoit dès
    // la prise en charge et l'a déjà en main au moment de la dépose.
    await this.requestDropoffOtp(booking.id, booking.trip.driverId);
  }

  async requestDropoffOtp(bookingId: string, driverId: string) {
    const booking = await this.getBookingWithContext(bookingId);
    this.assertDriverOwnsTrip(booking, driverId);
    return this.otpService.generateAndSend(
      { purpose: OtpPurpose.TRIP_DROPOFF, phone: booking.customer.user.phone, bookingId },
      'Communiquez ce code à votre conducteur pour confirmer la fin de votre trajet :',
    );
  }

  /** Même principe que revealPickupOtpForCustomer, pour le code de dépose. */
  async revealDropoffOtpForCustomer(bookingId: string, customerId: string) {
    const booking = await this.getBookingWithContext(bookingId);
    if (booking.customerId !== customerId) {
      throw new ForbiddenException('Cette réservation ne vous appartient pas.');
    }
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException('Cette réservation ne peut pas être clôturée dans son état actuel.');
    }
    return this.otpService.generateAndSend(
      { purpose: OtpPurpose.TRIP_DROPOFF, phone: booking.customer.user.phone, bookingId },
      'Communiquez ce code à votre conducteur pour confirmer la fin de votre trajet :',
      { revealCodeToCaller: true },
    );
  }

  /**
   * Confirme la dépose pour CETTE réservation : marque les passagers
   * déposés, clôt la réservation (COMPLETED) et libère les fonds tenus
   * en attente vers le solde disponible du conducteur (section 13,
   * "libération du paiement"). La clôture du trajet lui-même (tous les
   * passagers déposés) reste une action distincte du conducteur — voir
   * TripsService.completeTrip.
   */
  async verifyDropoffOtp(bookingId: string, driverId: string, code: string) {
    const booking = await this.getBookingWithContext(bookingId);
    this.assertDriverOwnsTrip(booking, driverId);
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException('Cette réservation ne peut pas être clôturée dans son état actuel.');
    }

    await this.otpService.verify({ purpose: OtpPurpose.TRIP_DROPOFF, bookingId, code });
    await this.markDroppedOff(booking);
  }

  /**
   * Même principe que manuallyValidatePickup, pour la dépose : réservée
   * au support via un litige, jamais accessible au conducteur directement.
   */
  async manuallyValidateDropoff(bookingId: string) {
    const booking = await this.getBookingWithContext(bookingId);
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException('Cette réservation ne peut pas être clôturée dans son état actuel.');
    }
    await this.markDroppedOff(booking);
  }

  private async markDroppedOff(
    booking: Awaited<ReturnType<TripOtpService['getBookingWithContext']>>,
  ): Promise<void> {
    await this.prisma.tripPassenger.updateMany({
      where: { bookingId: booking.id },
      data: { droppedOffAt: new Date() },
    });
    await this.prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.COMPLETED },
    });

    await this.wallets.releaseHeldFunds({ driverId: booking.trip.driverId, bookingId: booking.id });
  }
}