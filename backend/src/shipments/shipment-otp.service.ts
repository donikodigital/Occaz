// backend/src/shipments/shipment-otp.service.ts
// [21/09/2026] v2 — propriété de l'envoi via Shipment.driverId.
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationChannel, NotificationType, OtpPurpose, ShipmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OtpService } from '../otp/otp.service';
import { WalletsService } from '../wallets/wallets.service';
import { DriverProfilesService } from '../profiles/driver-profiles/driver-profiles.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Section 17 : OTP récupération (l'expéditeur confirme la remise du
 * colis) puis OTP livraison (le destinataire confirme la réception). À
 * la différence d'un trajet, un envoi n'a qu'un seul destinataire final
 * — la livraison OTP-vérifiée clôture directement l'envoi (COMPLETED),
 * pas besoin d'une action de clôture séparée du chauffeur.
 */
@Injectable()
export class ShipmentOtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otpService: OtpService,
    private readonly wallets: WalletsService,
    private readonly driverProfiles: DriverProfilesService,
    private readonly notifications: NotificationsService,
  ) {}

  private async getShipmentWithContext(shipmentId: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { trip: true },
    });
    if (!shipment) throw new NotFoundException('Envoi introuvable.');
    return shipment;
  }

  /** Le chauffeur de l'envoi est celui qui l'a accepté (avec ou sans trajet) ; repli sur le trajet pour les anciennes lignes. */
  private assertDriverOwnsShipment(
    shipment: { driverId: string | null; trip: { driverId: string } | null },
    driverId: string,
  ) {
    const owner = shipment.driverId ?? shipment.trip?.driverId;
    if (owner !== driverId) {
      throw new ForbiddenException("Cet envoi ne vous est pas attribué.");
    }
  }

  private async recordTracking(shipmentId: string, status: ShipmentStatus) {
    await this.prisma.shipmentTracking.create({ data: { shipmentId, status } });
  }

  // ---------------------------------------------------------------------
  // Transitions opérationnelles (non-OTP) — pings du chauffeur
  // ---------------------------------------------------------------------

  async markPickupPending(shipmentId: string, driverId: string) {
    const shipment = await this.getShipmentWithContext(shipmentId);
    this.assertDriverOwnsShipment(shipment, driverId);
    if (shipment.status !== ShipmentStatus.DRIVER_ASSIGNED) {
      throw new BadRequestException('Seul un envoi DRIVER_ASSIGNED peut passer en attente de récupération.');
    }
    const updated = await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: { status: ShipmentStatus.PICKUP_PENDING },
    });
    await this.recordTracking(shipmentId, ShipmentStatus.PICKUP_PENDING);
    return updated;
  }

  async markInTransit(shipmentId: string, driverId: string) {
    const shipment = await this.getShipmentWithContext(shipmentId);
    this.assertDriverOwnsShipment(shipment, driverId);
    if (shipment.status !== ShipmentStatus.PICKED_UP) {
      throw new BadRequestException('Seul un envoi PICKED_UP peut passer en transit.');
    }
    const updated = await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: { status: ShipmentStatus.IN_TRANSIT },
    });
    await this.recordTracking(shipmentId, ShipmentStatus.IN_TRANSIT);
    return updated;
  }

  async markDeliveryPending(shipmentId: string, driverId: string) {
    const shipment = await this.getShipmentWithContext(shipmentId);
    this.assertDriverOwnsShipment(shipment, driverId);
    if (shipment.status !== ShipmentStatus.IN_TRANSIT) {
      throw new BadRequestException('Seul un envoi IN_TRANSIT peut passer en attente de livraison.');
    }
    const updated = await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: { status: ShipmentStatus.DELIVERY_PENDING },
    });
    await this.recordTracking(shipmentId, ShipmentStatus.DELIVERY_PENDING);
    return updated;
  }

  // ---------------------------------------------------------------------
  // OTP récupération
  // ---------------------------------------------------------------------

  async requestPickupOtp(shipmentId: string, driverId: string) {
    const shipment = await this.getShipmentWithContext(shipmentId);
    this.assertDriverOwnsShipment(shipment, driverId);
    if (shipment.status !== ShipmentStatus.PICKUP_PENDING) {
      throw new BadRequestException("L'envoi doit être en attente de récupération pour demander ce code.");
    }
    return this.otpService.generateAndSend(
      { purpose: OtpPurpose.SHIPMENT_PICKUP, phone: shipment.senderPhone, shipmentId },
      'Communiquez ce code au chauffeur pour confirmer la remise du colis :',
    );
  }

  async verifyPickupOtp(shipmentId: string, driverId: string, code: string) {
    const shipment = await this.getShipmentWithContext(shipmentId);
    this.assertDriverOwnsShipment(shipment, driverId);

    await this.otpService.verify({ purpose: OtpPurpose.SHIPMENT_PICKUP, shipmentId, code });

    const updated = await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: { status: ShipmentStatus.PICKED_UP },
    });
    await this.recordTracking(shipmentId, ShipmentStatus.PICKED_UP);

    return updated;
  }

  // ---------------------------------------------------------------------
  // OTP livraison
  // ---------------------------------------------------------------------

  async requestDeliveryOtp(shipmentId: string, driverId: string) {
    const shipment = await this.getShipmentWithContext(shipmentId);
    this.assertDriverOwnsShipment(shipment, driverId);
    if (shipment.status !== ShipmentStatus.DELIVERY_PENDING) {
      throw new BadRequestException("L'envoi doit être en attente de livraison pour demander ce code.");
    }
    return this.otpService.generateAndSend(
      { purpose: OtpPurpose.SHIPMENT_DELIVERY, phone: shipment.recipientPhone, shipmentId },
      'Communiquez ce code au chauffeur pour confirmer la réception du colis :',
    );
  }

  /**
   * Clôture directement l'envoi (DELIVERED -> COMPLETED) : contrairement
   * à un trajet à plusieurs réservations, un envoi n'a qu'un seul
   * destinataire — rien à attendre d'autre pour le considérer terminé.
   */
  async verifyDeliveryOtp(shipmentId: string, driverId: string, code: string) {
    const shipment = await this.getShipmentWithContext(shipmentId);
    this.assertDriverOwnsShipment(shipment, driverId);

    await this.otpService.verify({ purpose: OtpPurpose.SHIPMENT_DELIVERY, shipmentId, code });

    await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: { status: ShipmentStatus.DELIVERED },
    });
    await this.recordTracking(shipmentId, ShipmentStatus.DELIVERED);

    const completed = await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: { status: ShipmentStatus.COMPLETED },
    });
    await this.recordTracking(shipmentId, ShipmentStatus.COMPLETED);

    await this.wallets.releaseHeldFunds({ driverId, shipmentId });
    await this.driverProfiles.incrementCompletedShipments(driverId);

    const customer = await this.prisma.customerProfile.findUnique({
      where: { id: shipment.customerId },
      select: { userId: true },
    });
    if (customer) {
      await this.notifications.notify({
        userId: customer.userId,
        type: NotificationType.DELIVERY,
        channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL],
        fallbackTitle: 'Colis livré',
        fallbackBody: 'Votre envoi a été livré avec succès.',
      });
    }

    return completed;
  }
}