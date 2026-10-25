// backend/src/payments/payments.service.refund.spec.ts
// Remboursements : jamais deux fois, jamais plus que le montant payé, montant exact, retour arrière si le prestataire échoue.
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { PaymentsService } from './payments.service';

function build(options: {
  paymentStatus?: PaymentStatus;
  alreadyRefunded?: bigint;
  claimCount?: number;
  providerFails?: boolean;
  hasCapturedTransaction?: boolean;
} = {}) {
  const payment = {
    id: 'pay1',
    bookingId: 'b1',
    shipmentId: null,
    amount: 20_000n,
    currencyId: 'GNF',
    status: options.paymentStatus ?? PaymentStatus.CAPTURED,
    updatedAt: new Date('2026-10-01T10:00:00Z'),
  };
  const tx = {
    payment: { updateMany: jest.fn().mockResolvedValue({ count: options.claimCount ?? 1 }) },
    paymentTransaction: { create: jest.fn().mockResolvedValue({ id: 'refund-row' }) },
  };
  const prisma = {
    payment: { findUnique: jest.fn().mockResolvedValue(payment), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    paymentTransaction: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: options.alreadyRefunded ?? null } }),
      findFirst: jest.fn().mockResolvedValue(
        options.hasCapturedTransaction === false
          ? null
          : { id: 'cap1', providerId: 'prov1', externalReference: 'EXT-1', provider: { type: 'ORANGE_MONEY' } },
      ),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
    booking: {
      findUnique: jest.fn().mockResolvedValue({ id: 'b1', trip: { driverId: 'dr1' } }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'b1', customer: { userId: 'uc' }, trip: { driverId: 'dr1' } }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    walletTransaction: { count: jest.fn().mockResolvedValue(0) },
    $transaction: jest.fn().mockImplementation((arg: unknown) =>
      typeof arg === 'function' ? (arg as (c: unknown) => unknown)(tx) : Promise.all(arg as Promise<unknown>[]),
    ),
  };
  const adapter = {
    refund: options.providerFails
      ? jest.fn().mockRejectedValue(new Error('prestataire indisponible'))
      : jest.fn().mockResolvedValue({ externalReference: 'REF-1' }),
  };
  const wallets = {
    reverseHeldFunds: jest.fn().mockResolvedValue(undefined),
    deductHeldFunds: jest.fn().mockResolvedValue(true),
    releaseHeldFunds: jest.fn().mockResolvedValue(undefined),
  };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const service = new PaymentsService(
    prisma as never,
    {} as never,
    { resolve: () => adapter } as never,
    wallets as never,
    {} as never,
    {} as never,
    notifications as never,
    {} as never,
  );
  return { service, prisma, tx, adapter, wallets, notifications };
}

describe('PaymentsService.refundBooking', () => {
  it('rembourse intégralement : une seule requête au prestataire, fonds du conducteur repris, notification envoyée', async () => {
    const { service, adapter, wallets, notifications, prisma } = build();
    await expect(service.refundBooking('b1', 100)).resolves.toBe(20_000n);

    expect(adapter.refund).toHaveBeenCalledTimes(1);
    expect(adapter.refund).toHaveBeenCalledWith({ externalReference: 'EXT-1', amount: 20_000n });
    expect(wallets.reverseHeldFunds).toHaveBeenCalledWith(expect.objectContaining({ driverId: 'dr1', bookingId: 'b1' }));
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    // une réservation encore en cours passe à « remboursée »
    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: BookingStatus.REFUNDED } }),
    );
  });

  it("appel simultané perdu : rien n'est envoyé au prestataire, ni notification, ni reprise des fonds", async () => {
    const { service, adapter, wallets, notifications } = build({ claimCount: 0 });
    await expect(service.refundBooking('b1', 100)).resolves.toBe(0n);
    expect(adapter.refund).not.toHaveBeenCalled();
    expect(wallets.reverseHeldFunds).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('déjà entièrement remboursé : rien à faire', async () => {
    const { service, adapter } = build({ paymentStatus: PaymentStatus.REFUNDED });
    await expect(service.refundBooking('b1', 100)).resolves.toBe(0n);
    expect(adapter.refund).not.toHaveBeenCalled();
  });

  it('paiement non capturé : aucun remboursement, aucune notification « remboursé »', async () => {
    const { service, adapter, notifications } = build({ paymentStatus: PaymentStatus.PENDING });
    await expect(service.refundBooking('b1', 100)).resolves.toBe(0n);
    expect(adapter.refund).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('plafonne au solde restant : 15 000 déjà rendus sur 20 000, une demande de 100 % ne rend que 5 000', async () => {
    const { service, adapter } = build({ paymentStatus: PaymentStatus.PARTIALLY_REFUNDED, alreadyRefunded: 15_000n });
    await expect(service.refundBooking('b1', 100)).resolves.toBe(5_000n);
    expect(adapter.refund).toHaveBeenCalledWith({ externalReference: 'EXT-1', amount: 5_000n });
  });

  it("montant exact d'un litige : 7 500 sur 20 000 rend 7 500 (plus d'arrondi au pourcent)", async () => {
    const { service, adapter, wallets } = build();
    await expect(service.refundBooking('b1', 0, { amount: 7_500n })).resolves.toBe(7_500n);
    expect(adapter.refund).toHaveBeenCalledWith({ externalReference: 'EXT-1', amount: 7_500n });
    // remboursement partiel : le conducteur supporte sa part, ses fonds ne sont pas repris en totalité
    expect(wallets.reverseHeldFunds).not.toHaveBeenCalled();
    expect(wallets.deductHeldFunds).toHaveBeenCalledWith(
      expect.objectContaining({ driverId: 'dr1', bookingId: 'b1', refundedAmount: 7_500n, paidAmount: 20_000n }),
    );
  });

  it("une réservation déjà annulée reste « annulée » après un remboursement intégral", async () => {
    const { service, prisma } = build();
    await service.refundBooking('b1', 100);
    const where = prisma.booking.updateMany.mock.calls[0][0].where;
    expect(where.status).toEqual({ notIn: [BookingStatus.CANCELLED, BookingStatus.REFUNDED] });
  });

  it("le prestataire échoue : la réclamation est annulée (ligne supprimée, statut remis) et l'erreur remonte", async () => {
    const { service, prisma, notifications, wallets } = build({ providerFails: true });
    await expect(service.refundBooking('b1', 100)).rejects.toThrow('prestataire indisponible');
    expect(prisma.paymentTransaction.delete).toHaveBeenCalledWith({ where: { id: 'refund-row' } });
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({ where: { id: 'pay1' }, data: { status: PaymentStatus.CAPTURED } });
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(wallets.reverseHeldFunds).not.toHaveBeenCalled();
  });

  it('pourcentage nul : rien à faire', async () => {
    const { service, prisma } = build();
    await expect(service.refundBooking('b1', 0)).resolves.toBe(0n);
    expect(prisma.payment.findUnique).not.toHaveBeenCalled();
  });
});

describe('PaymentsService.handleBookingCancelled — le conducteur garde la part non remboursée', () => {
  const event = (percentage: number | null) => ({ bookingId: 'b1', reason: 'Imprévu', refundEligiblePercentage: percentage }) as never;

  it('annulation tardive à 25 % remboursés : le client reçoit 25 %, le conducteur reçoit le reste dans son solde', async () => {
    const { service, adapter, wallets } = build();
    await service.handleBookingCancelled(event(25));
    expect(adapter.refund).toHaveBeenCalledWith({ externalReference: 'EXT-1', amount: 5_000n });
    expect(wallets.deductHeldFunds).toHaveBeenCalledWith(expect.objectContaining({ refundedAmount: 5_000n, paidAmount: 20_000n }));
    expect(wallets.releaseHeldFunds).toHaveBeenCalledWith({ driverId: 'dr1', bookingId: 'b1' });
    expect(wallets.reverseHeldFunds).not.toHaveBeenCalled();
  });

  it('annulation sans remboursement (0 %) : le conducteur reçoit toute sa part', async () => {
    const { service, adapter, wallets } = build();
    await service.handleBookingCancelled(event(0));
    expect(adapter.refund).not.toHaveBeenCalled();
    expect(wallets.releaseHeldFunds).toHaveBeenCalledWith({ driverId: 'dr1', bookingId: 'b1' });
    expect(wallets.reverseHeldFunds).not.toHaveBeenCalled();
  });

  it('remboursement intégral : le conducteur ne reçoit rien', async () => {
    const { service, wallets } = build();
    await service.handleBookingCancelled(event(100));
    expect(wallets.reverseHeldFunds).toHaveBeenCalled();
    expect(wallets.releaseHeldFunds).not.toHaveBeenCalled();
  });

  it('le remboursement du client échoue : rien n\'est versé au conducteur (reprise manuelle journalisée)', async () => {
    const { service, wallets } = build({ providerFails: true });
    await expect(service.handleBookingCancelled(event(25))).resolves.toBeUndefined();
    expect(wallets.releaseHeldFunds).not.toHaveBeenCalled();
  });
});
