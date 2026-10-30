// backend/src/wallets/wallets.service.mine-view.spec.ts
// GET wallets/mine : isole la part de « en attente » qui est le propre retrait du conducteur (≠ gains en attente de dépose).
import { PayoutStatus } from '@prisma/client';
import { WalletsService } from './wallets.service';

function build(pendingBalance: bigint, inProgressSum: bigint | null) {
  const prisma = {
    wallet: { findUnique: jest.fn().mockResolvedValue({ id: 'w1', driverId: 'd1', balance: 10_000n, pendingBalance, currency: { id: 'xof', isoCode: 'XOF' } }) },
    payout: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: inProgressSum } }) },
  };
  const service = new WalletsService(prisma as never, { log: jest.fn() } as never, { notify: jest.fn() } as never, {} as never);
  return { service, prisma };
}

describe('WalletsService.findMineView', () => {
  it('sépare le retrait en cours des gains qui attendent la dépose', async () => {
    const { service, prisma } = build(25_258n, 3_000n);
    const view = await service.findMineView('d1');
    expect(view.pendingBalance).toBe(25_258n);
    expect(view.payoutsInProgress).toBe(3_000n);
    expect(prisma.payout.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { walletId: 'w1', status: { in: [PayoutStatus.REQUESTED, PayoutStatus.PROCESSING] } } }),
    );
  });

  it('vaut 0 sans retrait en cours', async () => {
    const { service } = build(5_000n, null);
    expect((await service.findMineView('d1')).payoutsInProgress).toBe(0n);
  });

  it('ne dépasse jamais le montant réellement en attente', async () => {
    const { service } = build(2_000n, 9_000n);
    expect((await service.findMineView('d1')).payoutsInProgress).toBe(2_000n);
  });
});
