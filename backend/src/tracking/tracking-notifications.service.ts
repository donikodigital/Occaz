// backend/src/tracking/tracking-notifications.service.ts
// [10/10/2026] v1 — Ce qui part tout seul pendant la vie d'un colis : e-mails à l'expéditeur et au destinataire (s'il a donné son
// adresse), notification dans l'application de l'expéditeur, et une ligne d'historique « Passage à Kindia » quand le conducteur
// signale son arrivée dans une ville traversée.
//
// Un échec (e-mail refusé, notification impossible) est journalisé et n'empêche JAMAIS le conducteur d'avancer : tout passe par des
// événements asynchrones (voir DOMAIN_EVENTS.SHIPMENT_STATUS_CHANGED et TRIP_STOP_REACHED).
import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationChannel, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EMAIL_PROVIDER, EmailProvider } from '../integrations/email/email-provider.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { DOMAIN_EVENTS, ShipmentStatusChangedEvent, TripStopReachedEvent } from '../common/events/domain-events';
import { formatTrackingNumber, shipmentTrackingNumber } from '../tickets/ticket-codes';
import {
  EMAIL_AUDIENCES,
  isTrackedStatus,
  passageNotification,
  statusNotification,
  trackingEmail,
  type TrackingAudience,
} from './tracking-emails';
import { CARRIED_STATUSES, PASSAGE_NOTE_PREFIX, freshTripPosition } from './tracking-view';

/** Une position plus vieille que ça n'est pas enregistrée dans l'historique : mieux vaut aucune position qu'une fausse. */
const HISTORY_GPS_MAX_AGE_MS = 30 * 60 * 1000;

@Injectable()
export class TrackingNotificationsService {
  private readonly logger = new Logger(TrackingNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
    private readonly notifications: NotificationsService,
  ) {}

  /** Adresse publique de la page de suivi (sans « / » final), ex. https://occaz.app — absente : les e-mails n'ont pas de lien. */
  private trackingUrl(trackingNumber: string): string | null {
    const base = process.env.TRACKING_BASE_URL?.trim().replace(/\/+$/, '');
    return base ? `${base}/suivi/${trackingNumber}` : null;
  }

  @OnEvent(DOMAIN_EVENTS.SHIPMENT_STATUS_CHANGED, { async: true })
  async onStatusChanged(event: ShipmentStatusChangedEvent): Promise<void> {
    try {
      await this.announceStatus(event.shipmentId, event.status);
    } catch (error) {
      this.logger.warn(`Suivi de l'envoi ${event.shipmentId} (${event.status}) : notification non envoyée — ${(error as Error).message}`);
    }
  }

  @OnEvent(DOMAIN_EVENTS.TRIP_STOP_REACHED, { async: true })
  async onStopReached(event: TripStopReachedEvent): Promise<void> {
    try {
      await this.recordPassage(event.tripId, event.cityName);
    } catch (error) {
      this.logger.warn(`Passage à ${event.cityName} (trajet ${event.tripId}) : suivi des colis non mis à jour — ${(error as Error).message}`);
    }
  }

  async announceStatus(shipmentId: string, status: string): Promise<void> {
    if (!isTrackedStatus(status)) return;

    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        customer: { select: { firstName: true, user: { select: { id: true, email: true } } } },
        senderLocation: { include: { city: true } },
        recipientLocation: { include: { city: true } },
        driver: { select: { firstName: true } },
      },
    });
    if (!shipment) return;

    const trackingNumber = shipmentTrackingNumber(shipment.id);
    const formatted = formatTrackingNumber(trackingNumber);
    const pickupCity = shipment.senderLocation?.city?.name ?? 'départ';
    const deliveryCity = shipment.recipientLocation?.city?.name ?? 'destination';
    const driverFirstName = shipment.driver?.firstName ?? null;
    const url = this.trackingUrl(trackingNumber);

    const targets: Array<{ audience: TrackingAudience; email: string | null; firstName: string }> = [
      { audience: 'SENDER', email: shipment.customer?.user?.email ?? null, firstName: shipment.customer?.firstName ?? shipment.senderName },
      { audience: 'RECIPIENT', email: shipment.recipientEmail ?? null, firstName: firstWord(shipment.recipientName) },
    ];

    for (const target of targets) {
      if (!target.email || !EMAIL_AUDIENCES[status].includes(target.audience)) continue;
      const { subject, body } = trackingEmail({
        audience: target.audience,
        status,
        firstName: target.firstName,
        senderName: shipment.senderName,
        pickupCity,
        deliveryCity,
        driverFirstName,
        parcelsCount: shipment.quantity,
        trackingNumber: formatted,
        trackingUrl: url,
      });
      try {
        await this.emailProvider.send(target.email, subject, body, url ? { url, label: 'Suivre mon colis' } : undefined);
      } catch (error) {
        this.logger.warn(`E-mail de suivi (${target.audience}, ${status}) non envoyé pour l'envoi ${shipmentId} : ${(error as Error).message}`);
      }
    }

    const text = statusNotification(status, { deliveryCity, driverFirstName });
    const senderUserId = shipment.customer?.user?.id;
    if (text && senderUserId) {
      await this.notifications.notify({
        userId: senderUserId,
        type: NotificationType.STATUS_CHANGE,
        channels: [NotificationChannel.PUSH],
        fallbackTitle: text.title,
        fallbackBody: text.body,
        pushData: { type: 'SHIPMENT_TRACKING', shipmentId },
      });
    }
  }

  /**
   * Le conducteur est arrivé dans une ville traversée : chaque colis qu'il transporte (récupéré, pas encore livré) reçoit une ligne
   * « Passage à <ville> » avec la position du moment, et son expéditeur une notification. Un colis qui doit être livré dans cette
   * ville n'est pas concerné : sa livraison a ses propres étapes.
   */
  async recordPassage(tripId: string, cityName: string): Promise<void> {
    const shipments = await this.prisma.shipment.findMany({
      where: { tripId, deletedAt: null, status: { in: CARRIED_STATUSES as never } },
      include: {
        trip: { select: { currentLatitude: true, currentLongitude: true, currentPositionUpdatedAt: true } },
        recipientLocation: { include: { city: true } },
        customer: { select: { user: { select: { id: true } } } },
      },
    });

    const now = new Date();
    for (const shipment of shipments) {
      if (shipment.recipientLocation?.city?.name === cityName) continue;
      try {
        const gps = freshTripPosition(shipment.trip, now, HISTORY_GPS_MAX_AGE_MS);
        await this.prisma.shipmentTracking.create({
          data: {
            shipmentId: shipment.id,
            status: shipment.status,
            note: `${PASSAGE_NOTE_PREFIX}${cityName}`,
            latitude: gps?.latitude ?? null,
            longitude: gps?.longitude ?? null,
          },
        });
        const userId = shipment.customer?.user?.id;
        if (userId) {
          const text = passageNotification(cityName, formatTrackingNumber(shipmentTrackingNumber(shipment.id)));
          await this.notifications.notify({
            userId,
            type: NotificationType.STATUS_CHANGE,
            channels: [NotificationChannel.PUSH],
            fallbackTitle: text.title,
            fallbackBody: text.body,
            pushData: { type: 'SHIPMENT_TRACKING', shipmentId: shipment.id },
          });
        }
      } catch (error) {
        this.logger.warn(`Passage à ${cityName} non enregistré pour l'envoi ${shipment.id} : ${(error as Error).message}`);
      }
    }
  }
}

function firstWord(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}
