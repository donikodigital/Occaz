// backend/src/wallets/held-funds-recovery.service.ts
// [30/10/2026] v1 — Reprise des fonds du conducteur restés « en attente » alors que la prestation est terminée. Une dépose validée, une
// livraison confirmée ou un client absent déclaré passent d'abord la réservation / l'envoi à son état final, PUIS libèrent l'argent : si
// la libération échoue entre les deux (base indisponible, redémarrage du serveur), la prestation est close mais le conducteur n'est pas
// payé, et plus aucun chemin normal ne retente. Ce traitement repère ces cas et relance la libération (WalletsService.releaseHeldFunds,
// qui ne libère que les lignes encore en attente — sûr à relancer, jamais de double crédit, et qui respecte un litige encore ouvert).
// Il rattrape aussi un envoi accepté par un conducteur dont la mise en attente du revenu n'a jamais été écrite.
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { BookingStatus, PaymentStatus, ShipmentStatus, WalletTransactionStatus, WalletTransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { NO_SHOW_REASON } from '../trips/trip-completion.service';
import { WalletsService } from './wallets.service';

const CHECK_INTERVAL_MS = 5 * 60_000;
/** Délai laissé au chemin normal (libération juste après la clôture) avant de reprendre la main. */
export const HELD_FUNDS_GRACE_MS = 5 * 60_000;
const BATCH_SIZE = 50;

/** Statuts d'un envoi qui ont déjà un conducteur et dont le revenu doit donc être en attente (ou libéré). */
const SHIPMENT_STATUSES_WITH_DRIVER = [
  ShipmentStatus.DRIVER_ASSIGNED,
  ShipmentStatus.PICKUP_PENDING,
  ShipmentStatus.PICKED_UP,
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.DELIVERY_PENDING,
  ShipmentStatus.DELIVERED,
  ShipmentStatus.COMPLETED,
];

export interface HeldFundsRecoveryResult {
  released: number;
  held: number;
  failed: number;
}

@Injectable()
export class HeldFundsRecoveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HeldFundsRecoveryService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallets: WalletsService,
    private readonly pricing: PricingService,
  ) {}

  onModuleInit(): void {
    if (process.env.HELD_FUNDS_RECOVERY_JOB === 'off') return;
    this.timer = setInterval(() => void this.runOnce(), CHECK_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce(now: Date = new Date()): Promise<HeldFundsRecoveryResult> {
    const result: HeldFundsRecoveryResult = { released: 0, held: 0, failed: 0 };
    if (this.running) return result;
    this.running = true;
    try {
      // Interrupteur de l'administration (Paramètres → Tâches automatiques) : lu à chaque passage.
      if ((await this.pricing.getNumericSetting('jobs.held_funds_recovery_enabled', 1)) === 0) return result;
      const cutoff = new Date(now.getTime() - HELD_FUNDS_GRACE_MS);

      for (const target of await this.finishedWithHeldFunds(cutoff)) {
        try {
          await this.wallets.releaseHeldFunds(target);
          result.released += 1;
        } catch (error) {
          result.failed += 1;
          this.logger.error(`Fonds en attente non libérés (${JSON.stringify(target)}) — nouvelle tentative au prochain passage`, error as Error);
        }
      }

      for (const shipmentId of await this.assignedWithoutRevenue(cutoff)) {
        try {
          if (await this.holdMissingShipmentRevenue(shipmentId)) result.held += 1;
        } catch (error) {
          result.failed += 1;
          this.logger.error(`Revenu de l'envoi ${shipmentId} non mis en attente — nouvelle tentative au prochain passage`, error as Error);
        }
      }
      return result;
    } catch (error) {
      this.logger.error('Échec de la reprise des fonds en attente', error as Error);
      return result;
    } finally {
      this.running = false;
    }
  }

  /** Prestations terminées (trajet déposé, client absent, colis livré) dont l'argent du conducteur est resté en attente. */
  private async finishedWithHeldFunds(cutoff: Date): Promise<Array<{ driverId: string; bookingId?: string; shipmentId?: string }>> {
    const bookingRows = await this.prisma.walletTransaction.findMany({
      where: {
        status: WalletTransactionStatus.PENDING,
        type: WalletTransactionType.BOOKING_REVENUE,
        bookingId: { not: null },
        booking: {
          updatedAt: { lt: cutoff },
          OR: [{ status: BookingStatus.COMPLETED }, { status: BookingStatus.CANCELLED, cancellationReason: NO_SHOW_REASON }],
        },
      },
      select: { bookingId: true, wallet: { select: { driverId: true } } },
      take: BATCH_SIZE,
    });
    const shipmentRows = await this.prisma.walletTransaction.findMany({
      where: {
        status: WalletTransactionStatus.PENDING,
        type: WalletTransactionType.SHIPMENT_REVENUE,
        shipmentId: { not: null },
        shipment: { updatedAt: { lt: cutoff }, status: { in: [ShipmentStatus.DELIVERED, ShipmentStatus.COMPLETED] } },
      },
      select: { shipmentId: true, wallet: { select: { driverId: true } } },
      take: BATCH_SIZE,
    });

    return [
      ...bookingRows.map((row: { bookingId: string | null; wallet: { driverId: string } }) => ({ driverId: row.wallet.driverId, bookingId: row.bookingId! })),
      ...shipmentRows.map((row: { shipmentId: string | null; wallet: { driverId: string } }) => ({ driverId: row.wallet.driverId, shipmentId: row.shipmentId! })),
    ];
  }

  /** Envois payés et confiés à un conducteur, mais sans aucune ligne de revenu : la mise en attente n'a jamais été écrite. */
  private async assignedWithoutRevenue(cutoff: Date): Promise<string[]> {
    const rows = await this.prisma.shipment.findMany({
      where: {
        driverId: { not: null },
        status: { in: SHIPMENT_STATUSES_WITH_DRIVER },
        updatedAt: { lt: cutoff },
        payment: { status: PaymentStatus.CAPTURED },
        walletTransactions: { none: { type: WalletTransactionType.SHIPMENT_REVENUE } },
      },
      select: { id: true },
      take: BATCH_SIZE,
    });
    return rows.map((row: { id: string }) => row.id);
  }

  private async holdMissingShipmentRevenue(shipmentId: string): Promise<boolean> {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: { driverId: true, totalAmount: true, platformFee: true, currencyId: true },
    });
    if (!shipment?.driverId) return false;
    // holdShipmentRevenue est idempotent (verrou du portefeuille + contrôle de la ligne existante).
    await this.wallets.holdShipmentRevenue({
      driverId: shipment.driverId,
      shipmentId,
      grossAmount: shipment.totalAmount,
      commission: shipment.platformFee,
      sourceCurrencyId: shipment.currencyId,
    });
    this.logger.warn(`Revenu de l'envoi ${shipmentId} mis en attente par la reprise (il n'avait pas été écrit à l'acceptation).`);
    return true;
  }
}
