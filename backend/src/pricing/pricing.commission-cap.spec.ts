// backend/src/pricing/pricing.commission-cap.spec.ts
import { ServiceType } from '@prisma/client';
import { PricingService } from './pricing.service';

function build(rule: Record<string, unknown> | null) {
  const prisma = { commissionRule: { findFirst: jest.fn().mockResolvedValue(rule) } };
  return new PricingService(prisma as never);
}
const compute = (service: PricingService, baseAmount: bigint) =>
  service.computeCommission({ serviceType: ServiceType.SHIPMENT, baseAmount });

describe('PricingService.computeCommission — plafond', () => {
  it('un pourcentage s\'applique normalement (10 % de 150 000 = 15 000)', async () => {
    expect(await compute(build({ percentage: 10 }), 150_000n)).toBe(15_000n);
  });

  it('un montant fixe supérieur au prix est ramené au prix : jamais de revenu négatif pour le conducteur', async () => {
    expect(await compute(build({ fixedAmount: 500_000n }), 150_000n)).toBe(150_000n);
  });

  it('le minimum configuré ne peut pas non plus dépasser le montant', async () => {
    expect(await compute(build({ percentage: 1, minAmount: 900_000n }), 100_000n)).toBe(100_000n);
  });

  it('sans règle, aucune commission', async () => {
    expect(await compute(build(null), 150_000n)).toBe(0n);
  });
});
