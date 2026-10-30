// backend/src/tickets/ticket-scan.service.ts
// [11/10/2026] v1 — le conducteur scanne le QR code d'un billet ou d'une étiquette de colis : on vérifie la signature (un code fabriqué à la
// main est refusé), puis que la réservation / le colis concerne bien l'un de SES trajets / envois et qu'il est valable.
// Le scan IDENTIFIE le billet ; il ne remplace jamais le code à 6 chiffres que le passager donne au conducteur (c'est lui qui valide la prise en charge).
import { ForbiddenException, Injectable } from '@nestjs/common';
import { BookingStatus, ShipmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { currentLanguage } from '../i18n/language-context';
import { translateText } from '../i18n/server-text';
import { bookingReference, formatTrackingNumber, shipmentTrackingNumber, verifyCode } from './ticket-codes';

/** Statuts d'une réservation dont le billet est valable (mêmes que pour le PDF). */
const VALID_BOOKING_STATUSES: BookingStatus[] = [BookingStatus.PAID, BookingStatus.CONFIRMED, BookingStatus.COMPLETED, BookingStatus.DISPUTED];
/** Un colis non payé, annulé ou remboursé n'est pas à transporter. */
const INVALID_SHIPMENT_STATUSES: ShipmentStatus[] = [ShipmentStatus.CREATED, ShipmentStatus.CANCELLED, ShipmentStatus.REFUNDED];

export type ScanReason = 'INVALID' | 'OTHER_DRIVER' | 'NOT_ACTIVE';

export interface ScanBookingInfo {
  bookingId: string;
  tripId: string;
  reference: string;
  status: BookingStatus;
  passengers: string[];
  seatsCount: number;
  boardedCount: number;
  from: string;
  to: string;
  departureAt: Date;
}

export interface ScanParcelInfo {
  shipmentId: string;
  trackingNumber: string;
  parcelNumber: number;
  parcelCount: number;
  status: ShipmentStatus;
  category: string;
  weightKg: number;
  from: string;
  to: string;
  recipientName: string;
}

export interface ScanResult {
  valid: boolean;
  kind?: 'BOOKING' | 'PARCEL';
  reason?: ScanReason;
  message: string;
  booking?: ScanBookingInfo;
  parcel?: ScanParcelInfo;
}

const refuse = (reason: ScanReason, message: string, kind?: 'BOOKING' | 'PARCEL'): ScanResult => ({ valid: false, reason, message, kind });

@Injectable()
export class TicketScanService {
  constructor(private readonly prisma: PrismaService) {}

  async scan(userId: string, code: string): Promise<ScanResult> {
    const driver = await this.prisma.driverProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!driver) throw new ForbiddenException('Seuls les conducteurs peuvent scanner un billet.');

    const verified = verifyCode(code);
    let result: ScanResult;
    if (!verified) result = refuse('INVALID', 'Ce QR code n’est pas un billet Occa’Z valide.');
    else if (verified.kind === 'BOOKING') result = await this.scanBooking(driver.id, verified.bookingId);
    else result = await this.scanParcel(driver.id, verified.shipmentId, verified.parcelNumber);
    return { ...result, message: translateText(result.message, currentLanguage()) };
  }

  private async scanBooking(driverId: string, bookingId: string): Promise<ScanResult> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        trip: { include: { originCity: { select: { name: true } }, destinationCity: { select: { name: true } } } },
        passengers: { select: { fullName: true, pickedUpAt: true } },
        customer: { select: { firstName: true, lastName: true } },
        boardingStop: { include: { city: { select: { name: true } } } },
        alightingStop: { include: { city: { select: { name: true } } } },
      },
    });
    if (!booking) return refuse('INVALID', 'Ce billet est introuvable.', 'BOOKING');
    if (booking.trip.driverId !== driverId) {
      return refuse('OTHER_DRIVER', 'Ce billet est celui d’un autre trajet : il ne concerne pas l’un de vos trajets.', 'BOOKING');
    }
    if (!VALID_BOOKING_STATUSES.includes(booking.status)) {
      return refuse('NOT_ACTIVE', 'Cette réservation n’est plus valable (annulée, remboursée ou non payée).', 'BOOKING');
    }

    const names = booking.passengers.map((passenger) => passenger.fullName.trim()).filter(Boolean);
    const info: ScanBookingInfo = {
      bookingId: booking.id,
      tripId: booking.tripId,
      reference: bookingReference(booking.id),
      status: booking.status,
      passengers: names.length > 0 ? names : [`${booking.customer.firstName} ${booking.customer.lastName}`.trim()],
      seatsCount: booking.seatsCount,
      boardedCount: booking.passengers.filter((passenger) => passenger.pickedUpAt !== null).length,
      from: booking.boardingStop?.city?.name ?? booking.trip.originCity.name,
      to: booking.alightingStop?.city?.name ?? booking.trip.destinationCity.name,
      departureAt: booking.trip.departureAt,
    };
    return { valid: true, kind: 'BOOKING', message: 'Billet valable.', booking: info };
  }

  private async scanParcel(driverId: string, shipmentId: string, parcelNumber: number): Promise<ScanResult> {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        category: { select: { name: true } },
        items: { select: { id: true } },
        senderLocation: { include: { city: { select: { name: true } } } },
        recipientLocation: { include: { city: { select: { name: true } } } },
      },
    });
    if (!shipment) return refuse('INVALID', 'Cette étiquette est introuvable.', 'PARCEL');
    if (shipment.driverId !== driverId) {
      return refuse('OTHER_DRIVER', 'Ce colis n’est pas l’un de vos envois.', 'PARCEL');
    }
    if (INVALID_SHIPMENT_STATUSES.includes(shipment.status)) {
      return refuse('NOT_ACTIVE', 'Cet envoi n’est plus à transporter (non payé, annulé ou remboursé).', 'PARCEL');
    }

    const parcelCount = Math.max(shipment.quantity, shipment.items.length, 1);
    if (parcelNumber > parcelCount) return refuse('INVALID', 'Cette étiquette ne correspond à aucun colis de l’envoi.', 'PARCEL');

    const info: ScanParcelInfo = {
      shipmentId: shipment.id,
      trackingNumber: formatTrackingNumber(shipmentTrackingNumber(shipment.id)),
      parcelNumber,
      parcelCount,
      status: shipment.status,
      category: shipment.category.name,
      weightKg: shipment.weightKg,
      from: shipment.senderLocation.city?.name ?? shipment.senderLocation.label,
      to: shipment.recipientLocation.city?.name ?? shipment.recipientLocation.label,
      recipientName: shipment.recipientName,
    };
    return { valid: true, kind: 'PARCEL', message: 'Colis reconnu.', parcel: info };
  }
}
