// backend/src/pricing/shipment-quote.spec.ts
import { BadRequestException } from '@nestjs/common';
import { PricingService } from './pricing.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Devis d'envoi v2 : réglages par défaut (aucune ligne PlatformSetting),
 * distance PostGIS simulée. Valeurs par défaut : base 2000, 1000/kg,
 * 300/km, urgence 5000, diviseur volumétrique 5000, coefficient routier
 * 1,3, valeur déclarée 1 % (minimum 0).
 */
function createService(options: { distanceMeters: number | null; locations?: unknown[] }) {
  const prisma = {
    platformSetting: { findUnique: jest.fn().mockResolvedValue(null) },
    $queryRaw: jest.fn().mockResolvedValue([{ distanceMeters: options.distanceMeters }]),
    location: { findMany: jest.fn().mockResolvedValue(options.locations ?? []) },
  } as unknown as PrismaService;
  return new PricingService(prisma);
}

const baseInput = {
  weightKg: 5,
  isUrgent: false,
  categoryPriceMultiplier: 1,
  senderLocationId: 'a',
  recipientLocationId: 'b',
};

describe('PricingService.computeShipmentQuote', () => {
  it('additionne base, poids, distance routière (vol d\'oiseau × 1,3)', async () => {
    const service = createService({ distanceMeters: 100_000 });
    const quote = await service.computeShipmentQuote(baseInput);
    // 2000 + 1000 × 5 kg + 300 × (100 km × 1,3 = 130 km)
    expect(quote.price).toBe(46_000n);
    expect(quote.distanceKm).toBe(130);
    expect(quote.chargeableWeightKg).toBe(5);
    expect(quote.volumetricWeightKg).toBeNull();
  });

  it('facture le poids volumétrique quand il dépasse le poids réel', async () => {
    const service = createService({ distanceMeters: 100_000 });
    const quote = await service.computeShipmentQuote({ ...baseInput, lengthCm: 50, widthCm: 40, heightCm: 30 });
    // 50×40×30 = 60 000 cm³ / 5000 = 12 kg > 5 kg réel
    expect(quote.volumetricWeightKg).toBe(12);
    expect(quote.chargeableWeightKg).toBe(12);
    expect(quote.price).toBe(2000n + 12_000n + 39_000n);
  });

  it('garde le poids réel quand il dépasse le poids volumétrique', async () => {
    const service = createService({ distanceMeters: 100_000 });
    const quote = await service.computeShipmentQuote({
      ...baseInput,
      weightKg: 30,
      lengthCm: 10,
      widthCm: 10,
      heightCm: 10,
    });
    expect(quote.chargeableWeightKg).toBe(30);
  });

  it('multiplie le volume par la quantité de colis', async () => {
    const service = createService({ distanceMeters: 100_000 });
    const quote = await service.computeShipmentQuote({
      ...baseInput,
      quantity: 2,
      lengthCm: 50,
      widthCm: 40,
      heightCm: 30,
    });
    expect(quote.volumetricWeightKg).toBe(24);
  });

  it('ajoute des frais proportionnels à la valeur déclarée puis la majoration d\'urgence', async () => {
    const service = createService({ distanceMeters: 100_000 });
    const quote = await service.computeShipmentQuote({
      ...baseInput,
      declaredValue: 200_000n,
      isUrgent: true,
    });
    // 46 000 + 1 % de 200 000 (2 000) + 5 000 d'urgence
    expect(quote.price).toBe(53_000n);
  });

  it('applique le multiplicateur de catégorie avant les frais fixes', async () => {
    const service = createService({ distanceMeters: 100_000 });
    const quote = await service.computeShipmentQuote({ ...baseInput, categoryPriceMultiplier: 1.5, isUrgent: true });
    expect(quote.price).toBe(BigInt(Math.round(46_000 * 1.5 + 5_000)));
  });

  it('se rabat sur la distance entre les villes quand une adresse n\'est pas géocodée', async () => {
    const service = createService({
      distanceMeters: null,
      locations: [
        { id: 'a', latitude: null, longitude: null, city: { latitude: 9.6412, longitude: -13.6773 } },
        { id: 'b', latitude: null, longitude: null, city: { latitude: 14.7167, longitude: -17.4677 } },
      ],
    });
    const quote = await service.computeShipmentQuote(baseInput);
    // Conakry -> Dakar : environ 640 km à vol d'oiseau
    expect(quote.distanceKm).toBeGreaterThan(700);
    expect(quote.distanceKm).toBeLessThan(950);
  });

  it('refuse plutôt que de facturer une distance nulle sans prévenir', async () => {
    const service = createService({
      distanceMeters: null,
      locations: [
        { id: 'a', latitude: null, longitude: null, city: null },
        { id: 'b', latitude: null, longitude: null, city: null },
      ],
    });
    await expect(service.computeShipmentQuote(baseInput)).rejects.toBeInstanceOf(BadRequestException);
  });

  describe('colis par colis', () => {
    it("calcule le prix de chaque colis, sans mélanger leurs poids ni leurs dimensions", async () => {
      const service = createService({ distanceMeters: 100_000 });
      const quote = await service.computeShipmentQuote({
        ...baseInput,
        parcels: [
          { weightKg: 5 },
          { weightKg: 2, lengthCm: 50, widthCm: 40, heightCm: 30 }, // 12 kg volumétriques > 2 kg réels
        ],
      });
      // Colis 1 : 2000 + 1000 × 5 + 300 × 130 = 46 000 ; colis 2 : 2000 + 1000 × 12 + 39 000 = 53 000
      expect(quote.parcels.map((parcel) => parcel.price)).toEqual([46_000n, 53_000n]);
      expect(quote.parcels[1].chargeableWeightKg).toBe(12);
      expect(quote.parcels[1].volumetricWeightKg).toBe(12);
      expect(quote.parcels[0].volumetricWeightKg).toBeNull();
      expect(quote.price).toBe(99_000n);
    });

    it("applique la valeur déclarée à son seul colis et le multiplicateur de catégorie à chacun", async () => {
      const service = createService({ distanceMeters: 100_000 });
      const quote = await service.computeShipmentQuote({
        ...baseInput,
        categoryPriceMultiplier: 2,
        parcels: [{ weightKg: 5, declaredValue: 200_000n }, { weightKg: 5 }],
      });
      expect(quote.parcels[0].price).toBe(92_000n + 2_000n);
      expect(quote.parcels[1].price).toBe(92_000n);
    });

    it("compte la majoration d'urgence une seule fois pour tout l'envoi", async () => {
      const service = createService({ distanceMeters: 100_000 });
      const quote = await service.computeShipmentQuote({
        ...baseInput,
        isUrgent: true,
        parcels: [{ weightKg: 5 }, { weightKg: 5 }, { weightKg: 5 }],
      });
      expect(quote.urgentSurcharge).toBe(5_000n);
      expect(quote.price).toBe(46_000n * 3n + 5_000n);
      // Le total est exactement la somme des lignes affichées.
      expect(quote.price).toBe(quote.parcels.reduce((sum, parcel) => sum + parcel.price, 0n) + quote.urgentSurcharge);
    });

    it('un seul colis coûte comme un envoi global équivalent', async () => {
      const service = createService({ distanceMeters: 100_000 });
      const global = await service.computeShipmentQuote({ ...baseInput, declaredValue: 200_000n, isUrgent: true });
      const single = await service.computeShipmentQuote({
        ...baseInput,
        isUrgent: true,
        parcels: [{ weightKg: 5, declaredValue: 200_000n }],
      });
      expect(single.price).toBe(global.price);
    });

    it('sans liste de colis, le devis global reste inchangé et ne renvoie aucune ligne', async () => {
      const service = createService({ distanceMeters: 100_000 });
      const quote = await service.computeShipmentQuote(baseInput);
      expect(quote.parcels).toEqual([]);
      expect(quote.urgentSurcharge).toBe(0n);
    });
  });
});
