// backend/src/promo-codes/promo-codes.service.release.spec.ts
// Codes promo : restitution quand la prestation n'aboutit pas, et limite par client re-vérifiée sous verrou.
import { ConflictException } from '@nestjs/common';
import { PromoCodesService } from './promo-codes.service';

function build(options: { redemption?: { id: string; promoCodeId: string } | null; deleted?: number; claimed?: number; userRedemptions?: number } = {}) {
  const tx = {
    promoCode: { updateMany: jest.fn().mockResolvedValue({ count: options.claimed ?? 1 }) },
    promoCodeRedemption: {
      findFirst: jest.fn().mockResolvedValue(options.redemption === undefined ? { id: 'r1', promoCodeId: 'p1' } : options.redemption),
      deleteMany: jest.fn().mockResolvedValue({ count: options.deleted ?? 1 }),
      create: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(options.userRedemptions ?? 1),
    },
  };
  const prisma = { $transaction: jest.fn().mockImplementation((cb: (c: unknown) => unknown) => cb(tx)) };
  return { service: new PromoCodesService(prisma as never), tx, prisma };
}

describe('PromoCodesService.release', () => {
  it("rend son utilisation au code : ligne supprimée, compteur décrémenté", async () => {
    const { service, tx } = build();
    await expect(service.release({ bookingId: 'b1' })).resolves.toBe(true);
    expect(tx.promoCodeRedemption.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { bookingId: 'b1' } }));
    expect(tx.promoCode.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
  });

  it('fonctionne aussi pour un envoi, et dans la transaction de l’appelant', async () => {
    const { service, tx, prisma } = build();
    await expect(service.release({ shipmentId: 's1' }, tx as never)).resolves.toBe(true);
    expect(tx.promoCodeRedemption.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { shipmentId: 's1' } }));
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('aucun code utilisé : rien à faire', async () => {
    const { service, tx } = build({ redemption: null });
    await expect(service.release({ bookingId: 'b1' })).resolves.toBe(false);
    expect(tx.promoCode.updateMany).not.toHaveBeenCalled();
  });

  it('idempotent : un second appel (ligne déjà supprimée) ne décrémente pas deux fois', async () => {
    const { service, tx } = build({ deleted: 0 });
    await expect(service.release({ bookingId: 'b1' })).resolves.toBe(false);
    expect(tx.promoCode.updateMany).not.toHaveBeenCalled();
  });

  it('sans référence : ne fait rien (jamais de suppression en masse)', async () => {
    const { service, tx } = build();
    await expect(service.release({})).resolves.toBe(false);
    expect(tx.promoCodeRedemption.deleteMany).not.toHaveBeenCalled();
  });
});

describe('PromoCodesService.redeem — limite par client sous verrou', () => {
  const promo = { id: 'p1', usageLimit: null, usedCount: 0, usageLimitPerUser: 1 };
  const params = { customerId: 'c1', bookingId: 'b1', discountAmount: 500n };

  it('première utilisation : acceptée', async () => {
    const { service, tx } = build({ userRedemptions: 1 });
    await expect(service.redeem(tx as never, promo, params)).resolves.toBeUndefined();
  });

  it('deux réservations simultanées du même client : la seconde dépasse la limite et est refusée (transaction annulée)', async () => {
    const { service, tx } = build({ userRedemptions: 2 });
    await expect(service.redeem(tx as never, promo, params)).rejects.toBeInstanceOf(ConflictException);
  });

  it('quota global atteint entre-temps : refusé', async () => {
    const { service, tx } = build({ claimed: 0 });
    await expect(service.redeem(tx as never, { ...promo, usageLimit: 10, usedCount: 10 }, params)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.promoCodeRedemption.create).not.toHaveBeenCalled();
  });
});
