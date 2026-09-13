// backend/src/pricing/pricing.service.spec.ts
import { PricingService } from './pricing.service';
import { ServiceType } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Mock minimal de PrismaService plutôt qu'un TestingModule complet —
 * PricingService n'a qu'une seule dépendance, l'instancier directement
 * est plus simple et tout aussi valide qu'un module de test Nest ici.
 * `mockImplementation` inspecte `where.countryId` plutôt que l'ordre
 * d'appel — plus robuste si l'implémentation change l'ordre des requêtes
 * sans changer le comportement observable.
 */
function createPrismaMock(rulesByCountryId: Record<string, unknown>) {
  return {
    commissionRule: {
      findFirst: jest.fn(({ where }: { where: { countryId: string | null } }) => {
        const key = where.countryId === null ? 'global' : where.countryId;
        return Promise.resolve(rulesByCountryId[key] ?? null);
      }),
    },
  } as unknown as PrismaService;
}

describe('PricingService.computeCommission', () => {
  it("renvoie 0 quand aucune règle n'est configurée (ni pays, ni globale)", async () => {
    const service = new PricingService(createPrismaMock({}));
    const fee = await service.computeCommission({
      serviceType: ServiceType.TRIP,
      countryId: 'gn',
      baseAmount: 100_000n,
    });
    expect(fee).toBe(0n);
  });

  it('applique un pourcentage sur le montant de base', async () => {
    const service = new PricingService(
      createPrismaMock({ global: { percentage: 15, fixedAmount: null, minAmount: null, maxAmount: null } }),
    );
    const fee = await service.computeCommission({
      serviceType: ServiceType.TRIP,
      countryId: null,
      baseAmount: 100_000n,
    });
    expect(fee).toBe(15_000n);
  });

  it('applique un montant fixe, en ignorant tout pourcentage éventuel', async () => {
    const service = new PricingService(
      createPrismaMock({ global: { percentage: 15, fixedAmount: 2_000n, minAmount: null, maxAmount: null } }),
    );
    const fee = await service.computeCommission({
      serviceType: ServiceType.SHIPMENT,
      countryId: null,
      baseAmount: 100_000n,
    });
    expect(fee).toBe(2_000n);
  });

  it('relève la commission au minimum configuré si le calcul tombe en dessous', async () => {
    const service = new PricingService(
      createPrismaMock({ global: { percentage: 5, fixedAmount: null, minAmount: 3_000n, maxAmount: null } }),
    );
    // 5% de 10 000 = 500, plancher à 3 000
    const fee = await service.computeCommission({
      serviceType: ServiceType.TRIP,
      countryId: null,
      baseAmount: 10_000n,
    });
    expect(fee).toBe(3_000n);
  });

  it('plafonne la commission au maximum configuré si le calcul dépasse', async () => {
    const service = new PricingService(
      createPrismaMock({ global: { percentage: 20, fixedAmount: null, minAmount: null, maxAmount: 10_000n } }),
    );
    // 20% de 1 000 000 = 200 000, plafonné à 10 000
    const fee = await service.computeCommission({
      serviceType: ServiceType.TRIP,
      countryId: null,
      baseAmount: 1_000_000n,
    });
    expect(fee).toBe(10_000n);
  });

  it('privilégie la règle spécifique au pays sur la règle globale quand les deux existent', async () => {
    const service = new PricingService(
      createPrismaMock({
        GN: { percentage: 10, fixedAmount: null, minAmount: null, maxAmount: null },
        global: { percentage: 25, fixedAmount: null, minAmount: null, maxAmount: null },
      }),
    );
    const fee = await service.computeCommission({
      serviceType: ServiceType.TRIP,
      countryId: 'GN',
      baseAmount: 100_000n,
    });
    expect(fee).toBe(10_000n);
  });

  it("retombe sur la règle globale si aucune règle spécifique n'existe pour ce pays", async () => {
    const service = new PricingService(
      createPrismaMock({ global: { percentage: 25, fixedAmount: null, minAmount: null, maxAmount: null } }),
    );
    const fee = await service.computeCommission({
      serviceType: ServiceType.TRIP,
      countryId: 'SN',
      baseAmount: 100_000n,
    });
    expect(fee).toBe(25_000n);
  });
});
