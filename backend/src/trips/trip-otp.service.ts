// backend/src/trips/trip-otp.service.ts
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, OtpPurpose, TripStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OtpService } from '../otp/otp.service';
import { WalletsService } from '../wallets/wallets.service';

/**
 * Section 17 : OTP départ (le passager donne le code au chauffeur — sa
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

  async requestPickupOtp(bookingId: string, driverId: string) {
    const booking = await this.getBookingWithContext(bookingId);
    this.assertDriverOwnsTrip(booking, driverId);
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(
        'Cette réservation doit être confirmée (paiement validé) avant la prise en charge.',
      );
    }
    if (
      booking.trip.status !== TripStatus.DRIVER_ARRIVED &&
      booking.trip.status !== TripStatus.PASSENGER_PICKED_UP
    ) {
      throw new BadRequestException(
        "Signalez d'abord votre arrivée (markDriverArrived) avant de demander le code de prise en charge.",
      );
    }
    return this.otpService.generateAndSend(
      { purpose: OtpPurpose.TRIP_PICKUP, phone: booking.customer.user.phone, bookingId },
      'Communiquez ce code à votre chauffeur pour confirmer votre prise en charge :',
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

    await this.prisma.tripPassenger.updateMany({
      where: { bookingId },
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
    await this.requestDropoffOtp(bookingId, driverId);
  }

  async requestDropoffOtp(bookingId: string, driverId: string) {
    const booking = await this.getBookingWithContext(bookingId);
    this.assertDriverOwnsTrip(booking, driverId);
    return this.otpService.generateAndSend(
      { purpose: OtpPurpose.TRIP_DROPOFF, phone: booking.customer.user.phone, bookingId },
      'Communiquez ce code à votre chauffeur pour confirmer la fin de votre trajet :',
    );
  }

  /**
   * Confirme la dépose pour CETTE réservation : marque les passagers
   * déposés, clôt la réservation (COMPLETED) et libère les fonds tenus
   * en attente vers le solde disponible du chauffeur (section 13,
   * "libération du paiement"). La clôture du trajet lui-même (tous les
   * passagers déposés) reste une action distincte du chauffeur — voir
   * TripsService.completeTrip.
   */
  async verifyDropoffOtp(bookingId: string, driverId: string, code: string) {
    const booking = await this.getBookingWithContext(bookingId);
    this.assertDriverOwnsTrip(booking, driverId);
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException('Cette réservation ne peut pas être clôturée dans son état actuel.');
    }

    await this.otpService.verify({ purpose: OtpPurpose.TRIP_DROPOFF, bookingId, code });

    await this.prisma.tripPassenger.updateMany({
      where: { bookingId },
      data: { droppedOffAt: new Date() },
    });
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.COMPLETED },
    });

    await this.wallets.releaseHeldFunds({ driverId, bookingId });
  }
}
