// backend/src/shipments/shipment-window.service.ts
// [21/09/2026] v1 — fin de plage : invitation à prolonger, remboursement à 100 %, nettoyage des envois impayés.
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { NotificationChannel, NotificationType, ShipmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ShipmentsService } from './shipments.service';

/** Fréquence de la vérification des plages de dates. */
const CHECK_INTERVAL_MS = 5 * 60_000;
const BATCH_SIZE = 100;

/**
 * Tâche planifiée du cycle de vie "plage de dates" d'un envoi :
 *
 * 1. Fin de plage sans chauffeur : le client est invité à prolonger
 *    (extensionRequestedAt posé, notification).
 * 2. Sans réponse après `shipment.extension_grace_hours` (24 h par défaut,
 *    réglable dans PlatformSetting) : envoi annulé, client remboursé à 100 %.
 * 3. Envoi jamais payé depuis `shipment.unpaid_expiry_hours` (24 h par
 *    défaut) : annulé, capacité de trajet libérée.
 *
 * Volontairement sans dépendance de planification externe : un simple
 * minuteur, et chaque étape est une mise à jour conditionnelle en base —
 * si plusieurs instances tournent, un envoi n'est traité qu'une fois.
 * Désactivable avec SHIPMENT_WINDOW_JOB=off (tests, scripts).
 */
@Injectable()
export class ShipmentWindowService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ShipmentWindowService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly notifications: NotificationsService,
    private readonly shipments: ShipmentsService,
  ) {}

  onModuleInit(): void {
    if (process.env.SHIPMENT_WINDOW_JOB === 'off') return;
    this.timer = setInterval(() => void this.runOnce(), CHECK_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.requestExtensions();
      await this.expireUnextended();
      await this.expireUnpaid();
    } catch (error) {
      this.logger.error('Échec de la vérification des plages de dates', error as Error);
    } finally {
      this.running = false;
    }
  }

  /** 1. Plage terminée sans chauffeur : on demande au client s'il prolonge. */
  private async requestExtensions(): Promise<void> {
    const graceHours = await this.pricing.getNumericSetting('shipment.extension_grace_hours', 24);
    const now = new Date();
    const due = await this.prisma.shipment.findMany({
      where: { status: ShipmentStatus.SEARCHING_DRIVER, windowEnd: { lt: now }, extensionRequestedAt: null },
      select: { id: true, customer: { select: { userId: true } } },
      take: BATCH_SIZE,
    });

    for (const shipment of due) {
      // Un seul traitement par envoi, même avec plusieurs instances.
      const claimed = await this.prisma.shipment.updateMany({
        where: { id: shipment.id, status: ShipmentStatus.SEARCHING_DRIVER, extensionRequestedAt: null },
        data: { extensionRequestedAt: now },
      });
      if (claimed.count === 0) continue;

      await this.notifications.notify({
        userId: shipment.customer.userId,
        type: NotificationType.SHIPMENT_EXTENSION,
        channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL],
        fallbackTitle: "Aucun chauffeur pour l'instant",
        fallbackBody: `La période prévue pour votre envoi est terminée sans qu'un chauffeur l'ait accepté. Prolongez-la dans l'application ; sans réponse de votre part sous ${graceHours} h, vous serez remboursé intégralement.`,
        pushData: { type: 'SHIPMENT_EXTENSION', shipmentId: shipment.id },
      });
    }
  }

  /** 2. Pas de prolongation dans le délai : annulation et remboursement à 100 %. */
  private async expireUnextended(): Promise<void> {
    const graceHours = await this.pricing.getNumericSetting('shipment.extension_grace_hours', 24);
    const threshold = new Date(Date.now() - graceHours * 3_600_000);
    const expired = await this.prisma.shipment.findMany({
      where: { status: ShipmentStatus.SEARCHING_DRIVER, extensionRequestedAt: { lt: threshold } },
      select: { id: true },
      take: BATCH_SIZE,
    });

    for (const shipment of expired) {
      try {
        await this.shipments.expireSearch(
          shipment.id,
          'Aucun chauffeur avant la fin de la période et pas de prolongation — remboursement intégral.',
        );
      } catch (error) {
        this.logger.error(`Échec de l'expiration de l'envoi ${shipment.id}`, error as Error);
      }
    }
  }

  /** 3. Envoi créé mais jamais payé : on libère la capacité réservée. */
  private async expireUnpaid(): Promise<void> {
    const expiryHours = await this.pricing.getNumericSetting('shipment.unpaid_expiry_hours', 24);
    const threshold = new Date(Date.now() - expiryHours * 3_600_000);
    const stale = await this.prisma.shipment.findMany({
      where: { status: ShipmentStatus.CREATED, createdAt: { lt: threshold } },
      select: { id: true },
      take: BATCH_SIZE,
    });

    for (const shipment of stale) {
      try {
        await this.shipments.expireUnpaid(shipment.id, 'Paiement non effectué dans le délai imparti.');
      } catch (error) {
        this.logger.error(`Échec de l'expiration de l'envoi impayé ${shipment.id}`, error as Error);
      }
    }
  }
}