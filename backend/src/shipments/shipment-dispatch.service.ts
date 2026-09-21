// backend/src/shipments/shipment-dispatch.service.ts
// [21/09/2026] v1 — annonce d'un envoi à tous les chauffeurs validés (push avec son + e-mail), sans donnée client.
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DriverAccountStatus, NotificationChannel, NotificationType, ShipmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DOMAIN_EVENTS, ShipmentSearchOpenedEvent } from '../common/events/domain-events';

/** Identifiant du canal Android (créé côté app, importance maximale) qui fait sonner l'alerte. */
export const SHIPMENT_REQUEST_CHANNEL_ID = 'shipment-requests';

/** Nombre de chauffeurs notifiés en parallèle — évite de saturer la base et le fournisseur de push. */
const NOTIFY_BATCH_SIZE = 25;

/**
 * Annonce d'un envoi aux chauffeurs : quand une demande passe en recherche
 * de chauffeur (ou est prolongée), TOUS les chauffeurs validés sont prévenus
 * en même temps par push (avec son) et e-mail — avec ou sans trajet établi.
 * Le premier qui accepte l'emporte (ShipmentsService.accept). Le message ne
 * contient jamais de donnée personnelle du client : villes, poids et gain
 * net seulement.
 */
@Injectable()
export class ShipmentDispatchService {
  private readonly logger = new Logger(ShipmentDispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // `async: true` : le paiement qui déclenche l'événement n'attend pas la fin des notifications.
  @OnEvent(DOMAIN_EVENTS.SHIPMENT_SEARCH_OPENED, { async: true })
  async handleSearchOpened(event: ShipmentSearchOpenedEvent): Promise<void> {
    try {
      await this.dispatch(event.shipmentId);
    } catch (error) {
      this.logger.error(`Échec de l'annonce de l'envoi ${event.shipmentId}`, error as Error);
    }
  }

  async dispatch(shipmentId: string): Promise<number> {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        category: true,
        currency: true,
        senderLocation: { include: { city: true } },
        recipientLocation: { include: { city: true } },
      },
    });
    if (!shipment || shipment.status !== ShipmentStatus.SEARCHING_DRIVER) return 0;

    const from = shipment.senderLocation.city?.name ?? shipment.senderLocation.label;
    const to = shipment.recipientLocation.city?.name ?? shipment.recipientLocation.label;
    const netAmount = shipment.totalAmount - shipment.platformFee;
    const amount = `${new Intl.NumberFormat('fr-FR').format(Number(netAmount))} ${shipment.currency.isoCode}`;
    const until = shipment.windowEnd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

    const drivers = await this.prisma.driverProfile.findMany({
      where: { status: DriverAccountStatus.VALIDATED, deletedAt: null, user: { isSuspended: false } },
      select: { userId: true },
    });

    for (let i = 0; i < drivers.length; i += NOTIFY_BATCH_SIZE) {
      const batch = drivers.slice(i, i + NOTIFY_BATCH_SIZE);
      await Promise.allSettled(
        batch.map((driver) =>
          this.notifications.notify({
            userId: driver.userId,
            type: NotificationType.SHIPMENT_REQUEST,
            channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL],
            payload: { category: shipment.category.name, from, to, weightKg: shipment.weightKg, amount, until },
            fallbackTitle: shipment.isUrgent ? 'Envoi urgent à transporter' : "Nouvelle demande d'envoi",
            fallbackBody: `${shipment.category.name} de ${from} vers ${to}, ${shipment.weightKg} kg, jusqu'au ${until}. Vous recevrez ${amount}. Premier arrivé, premier servi.`,
            pushData: { type: 'SHIPMENT_REQUEST', shipmentId },
            pushOptions: { channelId: SHIPMENT_REQUEST_CHANNEL_ID, priority: 'high' },
          }),
        ),
      );
    }

    this.logger.log(`Envoi ${shipmentId} annoncé à ${drivers.length} chauffeur(s).`);
    return drivers.length;
  }
}