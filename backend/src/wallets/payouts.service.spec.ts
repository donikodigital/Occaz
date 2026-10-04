// backend/src/wallets/payouts.service.spec.ts
import { BadRequestException } from '@nestjs/common';
import { PayoutStatus } from '@prisma/client';
import { PayoutsService } from './payouts.service';

function build(options: { status?: PayoutStatus; claimCount?: number; finalizeFails?: boolean } = {}) {
  const payout = { id: 'p1', walletId: 'w1', amount: 50_000n, status: options.status ?? PayoutStatus.PROCESSING };
  const prisma = {
    payout: {
      findUnique: jest.fn().mockResolvedValue(payout),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ ...payout, status: PayoutStatus.PAID }),
      updateMany: jest.fn().mockResolvedValue({ count: options.claimCount ?? 1 }),
      update: jest.fn().mockResolvedValue(payout),
    },
    wallet: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'w1', driverId: 'dr1' }) },
  };
  const wallets = {
    finalizePayout: options.finalizeFails
      ? jest.fn().mockRejectedValue(new Error('base indisponible'))
      : jest.fn().mockResolvedValue(undefined),
    reversePayout: jest.fn().mockResolvedValue(undefined),
  };
  const service = new PayoutsService(prisma as never, { log: jest.fn() } as never, wallets as never);
  return { service, prisma, wallets };
}

describe('PayoutsService — un retrait ne se clôture qu\'une fois', () => {
  it('markPaid : réclame le statut puis décompte le solde en attente', async () => {
    const { service, prisma, wallets } = build();
    await service.markPaid('p1', 'admin');
    expect(prisma.payout.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'p1', status: { in: [PayoutStatus.REQUESTED, PayoutStatus.PROCESSING] } } }),
    );
    expect(wallets.finalizePayout).toHaveBeenCalledTimes(1);
  });

  it('markPaid sur un retrait déjà clôturé : refus, le solde n\'est pas touché', async () => {
    const { service, wallets } = build({ status: PayoutStatus.PAID, claimCount: 0 });
    await expect(service.markPaid('p1', 'admin')).rejects.toBeInstanceOf(BadRequestException);
    expect(wallets.finalizePayout).not.toHaveBeenCalled();
  });

  it('markFailed après un « payé » : refus, l\'argent déjà viré n\'est pas remis au conducteur', async () => {
    const { service, wallets } = build({ status: PayoutStatus.PAID, claimCount: 0 });
    await expect(service.markFailed('p1', 'virement refusé', 'admin')).rejects.toBeInstanceOf(BadRequestException);
    expect(wallets.reversePayout).not.toHaveBeenCalled();
  });

  it('markPaid : si le décompte échoue, le retrait est rouvert pour pouvoir être retraité', async () => {
    const { service, prisma } = build({ finalizeFails: true });
    await expect(service.markPaid('p1', 'admin')).rejects.toThrow('base indisponible');
    expect(prisma.payout.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: PayoutStatus.PROCESSING }) }),
    );
  });
});
