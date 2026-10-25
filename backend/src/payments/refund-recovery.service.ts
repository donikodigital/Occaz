// backend/src/payments/refund-recovery.service.ts
// [25/10/2026] v1 — Reprise automatique des remboursements d'annulation restés en échec. Si le prestataire de paiement est en panne au
// moment d'une annulation, la réservation (ou l'envoi) reste annulée mais le client n'est pas remboursé et les fonds du conducteur restent
// en attente : ce traitement repère ces cas, refait exactement le remboursement décidé à l'annulation (Booking/Shipment.refundPercentage)
// puis, si l'opération échoue encore plus d'une heure après l'annulation, prévient le support une seule fois.
// Sûr à relancer : le remboursement est réclamé en base et plafonné au montant payé (PaymentsService.executeRefund).
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { BookingStatus, NotificationChannel, NotificationType, PaymentStatus, ShipmentStatus, WalletTransactionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { PaymentsService } from './payments.service';

const CHECK_INTERVAL_MS = 5 * 60_000;
/** Délai laissé au chemin normal (événement d'annulation) avant de reprendre la main. */
export const RECOVERY_DELAY_MS = 10 * 60_000;
/** Au-delà de ce délai après l'annulation, un échec persistant est signalé au support. */
export const ALERT_AFTER_MS = 60 * 60_000;
const LOOKBACK_MS = 30 * 24 * 3_600_000;
const BATCH_SIZE = 50;

export const REFUND_STUCK_ACTION = 'REFUND_STUCK';
export const REFUND_RECOVERED_ACTION = 'REFUND_RECOVERED';

type Kind = 'Booking' | 'Shipment';

interface Candidate {
  kind: Kind;
  id: string;
  percentage: number;
  reason: string;
  cancelledAt: Date;
  /** Le paiement n'a jamais été remboursé : la reprise doit rembourser. Sinon, elle termine seulement le sort des fonds du conducteur. */
  needsRefund: boolean;
}

@Injectable()
export class RefundRecoveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RefundRecoveryService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly pricing: PricingService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    if (process.env.REFUND_RECOVERY_JOB === 'off') return;
    this.timer = setInterval(() => void this.runOnce(), CHECK_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Renvoie le nombre d'annulations reprises avec succès. */
  async runOnce(now: Date = new Date()): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      // Interrupteur de l'administration (Paramètres → Tâches automatiques) : lu à chaque passage.
      if ((await this.pricing.getNumericSetting('jobs.refund_recovery_enabled', 1)) === 0) return 0;

      const candidates = [...(await this.bookingCandidates(now)), ...(await this.shipmentCandidates(now))];
      let recovered = 0;
      for (const candidate of candidates) {
        if (await this.recover(candidate, now)) recovered += 1;
      }
      return recovered;
    } catch (error) {
      this.logger.error('Échec de la reprise automatique des remboursements', error as Error);
      return 0;
    } finally {
      this.running = false;
    }
  }

  // ---------------------------------------------------------------------

  private window(now: Date) {
    return { gte: new Date(now.getTime() - LOOKBACK_MS), lte: new Date(now.getTime() - RECOVERY_DELAY_MS) };
  }

  /** Réservations annulées dont le client n'a pas été remboursé, ou dont les fonds du conducteur sont restés en attente. */
  private async bookingCandidates(now: Date): Promise<Candidate[]> {
    const cancelledAt = this.window(now);
    const select = { id: true, refundPercentage: true, cancellationReason: true, cancelledAt: true, payment: { select: { status: true } } } as const;

    const unrefunded = await this.prisma.booking.findMany({
      where: { status: BookingStatus.CANCELLED, cancelledAt, refundPercentage: { gt: 0 }, payment: { status: PaymentStatus.CAPTURED } },
      select,
      orderBy: { cancelledAt: 'asc' },
      take: BATCH_SIZE,
    });
    const heldRows = await this.prisma.walletTransaction.findMany({
      where: {
        status: WalletTransactionStatus.PENDING,
        bookingId: { not: null },
        booking: { status: BookingStatus.CANCELLED, cancelledAt, refundPercentage: { not: null } },
      },
      select: { bookingId: true },
      distinct: ['bookingId'],
      take: BATCH_SIZE,
    });
    const heldIds = heldRows.map((row: { bookingId: string | null }) => row.bookingId).filter((id): id is string => Boolean(id));
    const held = heldIds.length
      ? await this.prisma.booking.findMany({ where: { id: { in: heldIds, notIn: unrefunded.map((b: { id: string }) => b.id) } }, select })
      : [];

    return [...unrefunded, ...held].map((booking: any) => ({
      kind: 'Booking' as const,
      id: booking.id,
      percentage: booking.refundPercentage ?? 0,
      reason: booking.cancellationReason ?? 'Annulation',
      cancelledAt: booking.cancelledAt ?? now,
      needsRefund: booking.payment?.status === PaymentStatus.CAPTURED && (booking.refundPercentage ?? 0) > 0,
    }));
  }

  private async shipmentCandidates(now: Date): Promise<Candidate[]> {
    const cancelledAt = this.window(now);
    const select = { id: true, refundPercentage: true, cancellationReason: true, cancelledAt: true, payment: { select: { status: true } } } as const;

    const unrefunded = await this.prisma.shipment.findMany({
      where: { status: ShipmentStatus.CANCELLED, cancelledAt, refundPercentage: { gt: 0 }, payment: { status: PaymentStatus.CAPTURED } },
      select,
      orderBy: { cancelledAt: 'asc' },
      take: BATCH_SIZE,
    });
    const heldRows = await this.prisma.walletTransaction.findMany({
      where: {
        status: WalletTransactionStatus.PENDING,
        shipmentId: { not: null },
        shipment: { status: ShipmentStatus.CANCELLED, cancelledAt, refundPercentage: { not: null } },
      },
      select: { shipmentId: true },
      distinct: ['shipmentId'],
      take: BATCH_SIZE,
    });
    const heldIds = heldRows.map((row: { shipmentId: string | null }) => row.shipmentId).filter((id): id is string => Boolean(id));
    const held = heldIds.length
      ? await this.prisma.shipment.findMany({ where: { id: { in: heldIds, notIn: unrefunded.map((s: { id: string }) => s.id) } }, select })
      : [];

    return [...unrefunded, ...held].map((shipment: any) => ({
      kind: 'Shipment' as const,
      id: shipment.id,
      percentage: shipment.refundPercentage ?? 0,
      reason: shipment.cancellationReason ?? 'Annulation',
      cancelledAt: shipment.cancelledAt ?? now,
      needsRefund: shipment.payment?.status === PaymentStatus.CAPTURED && (shipment.refundPercentage ?? 0) > 0,
    }));
  }

  private async recover(candidate: Candidate, now: Date): Promise<boolean> {
    try {
      const options = { skipRefund: !candidate.needsRefund };
      if (candidate.kind === 'Booking') {
        await this.payments.settleCancelledBooking(candidate.id, candidate.percentage, candidate.reason, options);
      } else {
        await this.payments.settleCancelledShipment(candidate.id, candidate.percentage, candidate.reason, options);
      }
      await this.audit.log({
        actorId: null,
        entityType: candidate.kind,
        entityId: candidate.id,
        action: REFUND_RECOVERED_ACTION,
        diff: { percentage: candidate.percentage, refunded: candidate.needsRefund },
      });
      return true;
    } catch (error) {
      this.logger.error(`Reprise du remboursement impossible pour ${candidate.kind} ${candidate.id}`, error as Error);
      if (now.getTime() - candidate.cancelledAt.getTime() >= ALERT_AFTER_MS) {
        await this.alertSupport(candidate, (error as Error).message).catch((alertError) =>
          this.logger.error("Alerte du support impossible pour un remboursement bloqué", alertError as Error),
        );
      }
      return false;
    }
  }

  /** Prévient les agents habilités à rembourser, une seule fois par réservation / envoi (la trace dans le journal sert de mémoire). */
  private async alertSupport(candidate: Candidate, message: string): Promise<void> {
    const already = await this.prisma.auditLog.findFirst({
      where: { entityType: candidate.kind, entityId: candidate.id, action: REFUND_STUCK_ACTION },
      select: { id: true },
    });
    if (already) return;

    await this.audit.log({
      actorId: null,
      entityType: candidate.kind,
      entityId: candidate.id,
      action: REFUND_STUCK_ACTION,
      diff: { percentage: candidate.percentage, error: message.slice(0, 300) },
    });

    const agents = await this.prisma.user.findMany({
      where: { userRoles: { some: { role: { permissions: { some: { permission: { key: PERMISSIONS.REFUND_CREATE } } } } } } },
      select: { id: true },
    });
    const label = candidate.kind === 'Booking' ? 'la réservation' : "l'envoi";
    await Promise.all(
      agents.map((agent: { id: string }) =>
        this.notifications.notify({
          userId: agent.id,
          type: NotificationType.REFUND,
          channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL],
          fallbackTitle: 'Remboursement bloqué',
          fallbackBody: `Le remboursement d'annulation de ${label} ${candidate.id} échoue depuis plus d'une heure (reprises automatiques sans succès). Un remboursement manuel est peut-être nécessaire.`,
          pushData: { type: 'REFUND' },
        }),
      ),
    );
  }
}
