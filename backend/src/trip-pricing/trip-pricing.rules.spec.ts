// backend/src/trip-pricing/trip-pricing.rules.spec.ts
import {
  CurrencyPricing,
  DEFAULT_TIERS,
  checkSemiAutoPrice,
  computeBounds,
  computeTieredAmount,
  isPricingMode,
  parseStoredCurrencyPricing,
  validateCurrencyPricing,
} from './trip-pricing.rules';

const GNF: CurrencyPricing = { tiers: DEFAULT_TIERS, roundingStep: 500, minPercent: 85, maxPercent: 120 };

describe('computeTieredAmount — paliers progressifs', () => {
  it('une distance dans la première tranche : km × tarif', () => {
    expect(computeTieredAmount(8, DEFAULT_TIERS)).toBe(8_000);
  });

  it('chaque tranche est facturée à son propre tarif (50 km = 10×1000 + 20×700 + 20×500)', () => {
    expect(computeTieredAmount(50, DEFAULT_TIERS)).toBe(34_000);
  });

  it('un trajet plus long ne coûte jamais moins cher qu\'un trajet plus court', () => {
    expect(computeTieredAmount(31, DEFAULT_TIERS)).toBeGreaterThanOrEqual(computeTieredAmount(30, DEFAULT_TIERS));
    expect(computeTieredAmount(71, DEFAULT_TIERS)).toBeGreaterThanOrEqual(computeTieredAmount(70, DEFAULT_TIERS));
  });

  it('au-delà de la dernière tranche, le dernier tarif continue de s\'appliquer', () => {
    expect(computeTieredAmount(270, DEFAULT_TIERS)).toBe(10_000 + 14_000 + 20_000 + 200 * 500);
  });

  it('distance nulle ou configuration vide : 0', () => {
    expect(computeTieredAmount(0, DEFAULT_TIERS)).toBe(0);
    expect(computeTieredAmount(10, [])).toBe(0);
  });
});

describe('computeBounds', () => {
  it('prix conseillé, minimum et maximum arrondis au pas', () => {
    expect(computeBounds(50, GNF)).toEqual({ suggested: 34_000n, min: 29_000n, max: 41_000n });
  });

  it('jamais moins qu\'un pas d\'arrondi, même pour une distance minuscule', () => {
    const bounds = computeBounds(0.1, GNF);
    expect(bounds.suggested).toBe(500n);
    expect(bounds.min).toBe(500n);
    expect(bounds.max).toBe(500n);
  });

  it('le conseillé reste toujours entre le minimum et le maximum', () => {
    for (const km of [1, 3.3, 12, 29.9, 47, 120, 800]) {
      const { suggested, min, max } = computeBounds(km, GNF);
      expect(min <= suggested && suggested <= max).toBe(true);
    }
  });
});

describe('checkSemiAutoPrice — seul le maximum bloque', () => {
  const bounds = computeBounds(50, GNF);

  it('accepte le prix conseillé, le maximum exact et un prix sous le minimum', () => {
    expect(checkSemiAutoPrice(bounds.suggested, bounds)).toEqual({ ok: true });
    expect(checkSemiAutoPrice(bounds.max, bounds)).toEqual({ ok: true });
    expect(checkSemiAutoPrice(1_000n, bounds)).toEqual({ ok: true });
  });

  it('refuse un prix au-dessus du maximum et renvoie les repères à afficher', () => {
    expect(checkSemiAutoPrice(bounds.max + 1n, bounds)).toEqual({ ok: false, max: bounds.max, suggested: bounds.suggested });
  });
});

describe('validateCurrencyPricing', () => {
  const valid = () => ({
    tiers: [
      { upToKm: 10, pricePerKm: 1000 },
      { upToKm: 30, pricePerKm: 700 },
      { upToKm: null, pricePerKm: 500 },
    ],
    roundingStep: 500,
    minPercent: 85,
    maxPercent: 120,
  });
  const error = (input: unknown) => {
    const verdict = validateCurrencyPricing(input);
    return verdict.ok ? null : verdict.error;
  };

  it('accepte une configuration correcte', () => {
    expect(validateCurrencyPricing(valid())).toEqual({ ok: true, value: valid() });
  });

  it('refuse une configuration absente ou sans tranche', () => {
    expect(error(null)).toMatch(/manquante/);
    expect(error({ ...valid(), tiers: [] })).toMatch(/au moins une tranche/);
  });

  it('refuse des fins de tranche qui ne sont pas strictement croissantes', () => {
    const input = valid();
    input.tiers[1].upToKm = 10;
    expect(error(input)).toMatch(/Tranche 2/);
  });

  it('exige que la dernière tranche soit ouverte (au-delà)', () => {
    const input = valid();
    input.tiers[2].upToKm = 100 as never;
    expect(error(input)).toMatch(/Tranche 3/);
  });

  it('refuse un prix au kilomètre nul, décimal ou négatif', () => {
    for (const pricePerKm of [0, -5, 10.5]) {
      const input = valid();
      input.tiers[0].pricePerKm = pricePerKm;
      expect(error(input)).toMatch(/Tranche 1/);
    }
  });

  it('borne l\'arrondi et les pourcentages', () => {
    expect(error({ ...valid(), roundingStep: 0 })).toMatch(/arrondi/);
    expect(error({ ...valid(), minPercent: 0 })).toMatch(/minimum/);
    expect(error({ ...valid(), minPercent: 101 })).toMatch(/minimum/);
    expect(error({ ...valid(), maxPercent: 99 })).toMatch(/maximum/);
    expect(error({ ...valid(), maxPercent: 501 })).toMatch(/maximum/);
  });

  it('refuse plus de 10 tranches', () => {
    const tiers = Array.from({ length: 11 }, (_, index) => ({ upToKm: index < 10 ? index + 1 : null, pricePerKm: 100 }));
    expect(error({ ...valid(), tiers })).toMatch(/Au plus 10/);
  });
});

describe('parseStoredCurrencyPricing / isPricingMode', () => {
  it('une valeur abîmée en base devient « non configurée »', () => {
    expect(parseStoredCurrencyPricing({ tiers: 'oups' })).toBeNull();
    expect(parseStoredCurrencyPricing(null)).toBeNull();
  });

  it('reconnaît les trois modes et rien d\'autre', () => {
    expect(['MANUAL', 'SEMI_AUTO', 'AUTO'].every(isPricingMode)).toBe(true);
    expect(isPricingMode('auto')).toBe(false);
    expect(isPricingMode(undefined)).toBe(false);
  });
});
