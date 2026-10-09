// backend/src/trips/trip-otp.service.ts
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BookingStatus, NotificationChannel, NotificationType, OtpPurpose, TripStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OtpService } from '../otp/otp.service';
import { WalletsService } from '../wallets/wallets.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BON_VOYAGE_BODY, BON_VOYAGE_TITLE } from './trip-arrival.service';

/**
 * [09/10/2026] v++ — Message de bienvenue : une fois la dépose validée, le client reçoit (notification + email) un mot de bienvenue
 * dans la ville où il arrive, avec ses souhaits de bon séjour.
 *
 * [09/10/2026] v+ — Le code de dépose n'est plus envoyé dès la prise en charge : il part à l'arrivée du conducteur au point de
 * descente du client, avec sa notification (TripArrivalService). Même chose pour le code de prise en charge, envoyé
 * automatiquement à l'arrivée du conducteur ; requestPickupOtp / requestDropoffOtp servent désormais à RENVOYER un code.
 *
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
    private readonly notifications: NotificationsService,
  ) {}

  private readonly logger = new Logger(TripOtpService.name);

  private async getBookingWithContext(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        trip: { include: { destinationCity: true } },
        customer: { include: { user: true } },
        alightingStop: { include: { city: true } },
      },
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

    // Un client qui monte alors que le trajet est déjà en route (étape) reçoit tout de suite son message de bon voyage : les clients
    // du départ, eux, le reçoivent quand le conducteur démarre (TripArrivalService.announceDeparture).
    if (booking.trip.status === TripStatus.IN_PROGRESS) {
      try {
        await this.notifications.notify({
          userId: booking.customer.userId,
          type: NotificationType.STATUS_CHANGE,
          channels: [NotificationChannel.PUSH],
          fallbackTitle: BON_VOYAGE_TITLE,
          fallbackBody: BON_VOYAGE_BODY,
          pushData: { type: 'STATUS_CHANGE', tripId: booking.tripId, bookingId: booking.id },
        });
      } catch (error) {
        this.logger.warn(`Message de bon voyage non envoyé pour la réservation ${booking.id} — ${(error as Error).message}.`);
      }
    }

    // Le code de dépose n'est plus généré ici : il part à l'arrivée du conducteur au point de descente du client (ville traversée
    // ou destination), avec sa notification — voir TripArrivalService. Il reste obtenable à tout moment (« Voir mon code » côté
    // client, « Renvoyer le code » côté conducteur).
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

    await this.sendWelcome(booking);
  }

  /**
   * Mot de bienvenue du client qui vient d'arriver (sa ville de descente, ou la destination du trajet). Jamais bloquant : la dépose
   * est déjà validée et le conducteur payé, un message manqué ne doit rien défaire.
   */
  private async sendWelcome(booking: Awaited<ReturnType<TripOtpService['getBookingWithContext']>>): Promise<void> {
    const city = booking.alightingStop?.city?.name ?? booking.trip.destinationCity?.name;
    const place = city ? ` à ${city}` : '';
    try {
      await this.notifications.notify({
        userId: booking.customer.userId,
        type: NotificationType.ARRIVAL,
        channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL],
        fallbackTitle: city ? `Bienvenue à ${city} !` : 'Bienvenue !',
        fallbackBody: `Vous êtes bien arrivé${place}. Toute l'équipe Occa'Z vous souhaite un excellent séjour${place} et vous remercie d'avoir voyagé avec nous.`,
        pushData: { type: 'ARRIVAL', tripId: booking.tripId, bookingId: booking.id },
      });
    } catch (error) {
      this.logger.warn(`Message de bienvenue non envoyé pour la réservation ${booking.id} — ${(error as Error).message}.`);
    }
  }
}