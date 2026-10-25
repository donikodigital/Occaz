// backend/src/payments/refund-recovery.service.spec.ts
// Reprise automatique des remboursements d'annulation : elle refait ce qui a été décidé à l'annulation, jamais plus, et prévient le support une seule fois.
import { PaymentStatus } from '@prisma/client';
import { ALERT_AFTER_MS, REFUND_RECOVERED_ACTION, REFUND_STUCK_ACTION, RECOVERY_DELAY_MS, RefundRecoveryService } from './refund-recovery.service';

const NOW = new Date('2026-10-25T12:00:00Z');
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

function build(options: {
  unrefundedBookings?: Array<Record<string, unknown>>;
  heldBookingIds?: string[];
  heldBookings?: Array<Record<string, unknown>>;
  unrefundedShipments?: Array<Record<string, unknown>>;
  settleFails?: boolean;
  enabled?: number;
  alreadyAlerted?: boolean;
} = {}) {
  const prisma = {
    booking: {
      findMany: jest.fn().mockImplementation((args: { where: { id?: unknown } }) =>
        Promise.resolve(args.where.id ? (options.heldBookings ?? []) : (options.unrefundedBookings ?? [])),
      ),
    },
    shipment: { findMany: jest.fn().mockResolvedValue(options.unrefundedShipments ?? []) },
    walletTransaction: {
      findMany: jest.fn().mockImplementation((args: { where: { bookingId?: unknown } }) =>
        Promise.resolve(args.where.bookingId ? (options.heldBookingIds ?? []).map((bookingId) => ({ bookingId })) : []),
      ),
    },
    auditLog: { findFirst: jest.fn().mockResolvedValue(options.alreadyAlerted ? { id: 'x' } : null) },
    user: { findMany: jest.fn().mockResolvedValue([{ id: 'agent1' }, { id: 'agent2' }]) },
  };
  const payments = {
    settleCancelledBooking: options.settleFails
      ? jest.fn().mockRejectedValue(new Error('prestataire indisponible'))
      : jest.fn().mockResolvedValue(undefined),
    settleCancelledShipment: jest.fn().mockResolvedValue(undefined),
  };
  const pricing = { getNumericSetting: jest.fn().mockResolvedValue(options.enabled ?? 1) };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const service = new RefundRecoveryService(prisma as never, payments as never, pricing as never, notifications as never, audit as never);
  return { service, prisma, payments, pricing, notifications, audit };
}

const unrefunded = (id: string, cancelledMinutesAgo: number, percentage = 80) => ({
  id,
  refundPercentage: percentage,
  cancellationReason: 'Annulation client',
  cancelledAt: minutesAgo(cancelledMinutesAgo),
  payment: { status: PaymentStatus.CAPTURED },
});

describe('RefundRecoveryService.runOnce', () => {
  it('rembourse une réservation annulée jamais remboursée, avec le pourcentage décidé à l’annulation', async () => {
    const { service, payments, audit } = build({ unrefundedBookings: [unrefunded('b1', 30, 80)] });
    await expect(service.runOnce(NOW)).resolves.toBe(1);
    expect(payments.settleCancelledBooking).toHaveBeenCalledWith('b1', 80, 'Annulation client', { skipRefund: false });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'Booking', entityId: 'b1', action: REFUND_RECOVERED_ACTION }));
  });

  it('ne rembourse pas une seconde fois : un paiement déjà remboursé ne reprend que le sort des fonds du conducteur', async () => {
    const { service, payments } = build({
      heldBookingIds: ['b2'],
      heldBookings: [{ ...unrefunded('b2', 30, 100), payment: { status: PaymentStatus.REFUNDED } }],
    });
    await service.runOnce(NOW);
    expect(payments.settleCancelledBooking).toHaveBeenCalledWith('b2', 100, 'Annulation client', { skipRefund: true });
  });

  it('reprend aussi les envois annulés', async () => {
    const { service, payments } = build({ unrefundedShipments: [unrefunded('s1', 30, 100)] });
    await expect(service.runOnce(NOW)).resolves.toBe(1);
    expect(payments.settleCancelledShipment).toHaveBeenCalledWith('s1', 100, 'Annulation client', { skipRefund: false });
  });

  it('ne touche que les annulations dont le pourcentage a été enregistré, assez anciennes (le chemin normal a eu sa chance)', async () => {
    const { service, prisma } = build();
    await service.runOnce(NOW);
    const where = prisma.booking.findMany.mock.calls[0][0].where;
    expect(where.refundPercentage).toEqual({ gt: 0 });
    expect(where.payment).toEqual({ status: PaymentStatus.CAPTURED });
    expect(where.cancelledAt.lte).toEqual(new Date(NOW.getTime() - RECOVERY_DELAY_MS));
    const heldWhere = prisma.walletTransaction.findMany.mock.calls[0][0].where;
    expect(heldWhere.booking.refundPercentage).toEqual({ not: null });
  });

  it('un échec récent est seulement journalisé : le support n’est pas encore prévenu', async () => {
    const { service, notifications } = build({ unrefundedBookings: [unrefunded('b3', 30)], settleFails: true });
    await expect(service.runOnce(NOW)).resolves.toBe(0);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('un échec qui dure prévient les agents habilités, une seule fois', async () => {
    const stuckForTooLong = unrefunded('b4', ALERT_AFTER_MS / 60_000 + 5);
    const first = build({ unrefundedBookings: [stuckForTooLong], settleFails: true });
    await first.service.runOnce(NOW);
    expect(first.notifications.notify).toHaveBeenCalledTimes(2);
    expect(first.audit.log).toHaveBeenCalledWith(expect.objectContaining({ entityId: 'b4', action: REFUND_STUCK_ACTION }));

    const second = build({ unrefundedBookings: [stuckForTooLong], settleFails: true, alreadyAlerted: true });
    await second.service.runOnce(NOW);
    expect(second.notifications.notify).not.toHaveBeenCalled();
  });

  it('respecte l’interrupteur de l’administration', async () => {
    const { service, prisma } = build({ enabled: 0, unrefundedBookings: [unrefunded('b5', 30)] });
    await expect(service.runOnce(NOW)).resolves.toBe(0);
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
  });
});
