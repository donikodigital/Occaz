// backend/src/referrals/referrals.service.auto-complete.spec.ts
import { ReferralStatus } from '@prisma/client';
import { ReferralsService } from './referrals.service';

/**
 * handleFirstPaymentConfirmed : appelée par PaymentsService juste après
 * confirmation d'un paiement — ne doit compléter le parrainage QUE si
 * c'est la toute première prestation confirmée du filleul, et ne jamais
 * planter (un souci de parrainage ne doit jamais faire échouer une
 * confirmation de paiement).
 */
function createService(options: {
  referral?: Record<string, unknown> | null;
  customer?: Record<string, unknown> | null;
  bookingsCount?: number;
  shipmentsCount?: number;
  rewardSetting?: number;
} = {}) {
  const referral =
    options.referral !== undefined
      ? options.referral
      : {
          id: 'ref1',
          status: ReferralStatus.PENDING,
          referrerId: 'u-parrain',
          referrer: { driverProfile: { id: 'driver1' } },
        };
  const customer = options.customer !== undefined ? options.customer : { id: 'cust1' };
  const prisma = {
    referral: { findUnique: jest.fn().mockResolvedValue(referral), update: jest.fn().mockResolvedValue({}) },
    customerProfile: { findUnique: jest.fn().mockResolvedValue(customer) },
    booking: { count: jest.fn().mockResolvedValue(options.bookingsCount ?? 1) },
    shipment: { count: jest.fn().mockResolvedValue(options.shipmentsCount ?? 0) },
  };
  const pricing = { getNumericSetting: jest.fn().mockResolvedValue(options.rewardSetting ?? 10_000) };
  const wallets = { adjustBalance: jest.fn().mockResolvedValue(undefined) };
  const service = new ReferralsService(prisma as never, pricing as never, wallets as never);
  return { service, prisma, wallets };
}

describe('ReferralsService.handleFirstPaymentConfirmed', () => {
  it('complète le parrainage et crédite le parrain chauffeur à la première prestation confirmée', async () => {
    const { service, prisma, wallets } = createService({ bookingsCount: 1, shipmentsCount: 0, rewardSetting: 20_000 });
    await service.handleFirstPaymentConfirmed('u-filleul');

    expect(wallets.adjustBalance).toHaveBeenCalledWith('driver1', '20000', expect.any(String), 'u-parrain');
    expect(prisma.referral.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ref1' }, data: expect.objectContaining({ status: ReferralStatus.COMPLETED, rewardAmount: 20_000n }) }),
    );
  });

  it("ne fait rien si ce n'est pas la première prestation confirmée", async () => {
    const { service, prisma, wallets } = createService({ bookingsCount: 2, shipmentsCount: 0 });
    await service.handleFirstPaymentConfirmed('u-filleul');

    expect(wallets.adjustBalance).not.toHaveBeenCalled();
    expect(prisma.referral.update).not.toHaveBeenCalled();
  });

  it("ne fait rien si l'utilisateur n'a pas de parrainage en attente", async () => {
    const { service, wallets } = createService({ referral: null });
    await service.handleFirstPaymentConfirmed('u-filleul');
    expect(wallets.adjustBalance).not.toHaveBeenCalled();
  });

  it('ne fait rien si le parrainage est déjà complété (pas de double crédit)', async () => {
    const { service, wallets } = createService({
      referral: { id: 'ref1', status: ReferralStatus.COMPLETED, referrerId: 'u-parrain', referrer: { driverProfile: { id: 'driver1' } } },
    });
    await service.handleFirstPaymentConfirmed('u-filleul');
    expect(wallets.adjustBalance).not.toHaveBeenCalled();
  });

  it('ne crédite aucun portefeuille si le parrain est un client (pas de portefeuille dans ce système), mais complète quand même', async () => {
    const { service, prisma, wallets } = createService({
      referral: { id: 'ref1', status: ReferralStatus.PENDING, referrerId: 'u-parrain', referrer: { driverProfile: null } },
    });
    await service.handleFirstPaymentConfirmed('u-filleul');

    expect(wallets.adjustBalance).not.toHaveBeenCalled();
    expect(prisma.referral.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: ReferralStatus.COMPLETED }) }));
  });

  it("ne fait rien si le filleul n'est pas (encore) client — un chauffeur ne paie jamais de prestation", async () => {
    const { service, wallets } = createService({ customer: null });
    await service.handleFirstPaymentConfirmed('u-filleul');
    expect(wallets.adjustBalance).not.toHaveBeenCalled();
  });
});