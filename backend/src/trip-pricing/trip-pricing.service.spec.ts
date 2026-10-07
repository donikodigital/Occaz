// backend/src/trip-pricing/trip-pricing.service.spec.ts
import { BadRequestException } from '@nestjs/common';
import { TripPricingService } from './trip-pricing.service';
import { CurrencyPricing, DEFAULT_TIERS } from './trip-pricing.rules';

const GNF_CONFIG: CurrencyPricing = { tiers: DEFAULT_TIERS, roundingStep: 500, minPercent: 85, maxPercent: 120 };
const GNF = { id: 'cur-gnf', isoCode: 'GNF', symbol: 'FG', name: 'Franc guinéen' };
const XOF = { id: 'cur-xof', isoCode: 'XOF', symbol: 'F', name: 'Franc CFA' };

/** Distance à vol d'oiseau 38,46 km × 1,3 = 50 km facturés : conseillé 34 000, min 29 000, max 41 000 (GNF par défaut). */
function build(options: { mode?: unknown; configs?: Record<string, unknown>; straightKm?: number | null; factor?: number } = {}) {
  const settings: Record<string, unknown> = { ...(options.mode === undefined ? {} : { 'trip_pricing.mode': options.mode }) };
  for (const [iso, config] of Object.entries(options.configs ?? { gnf: GNF_CONFIG })) settings[`trip_pricing.config.${iso}`] = config;

  const prisma = {
    platformSetting: {
      findUnique: jest.fn().mockImplementation(({ where }: { where: { key: string } }) =>
        Promise.resolve(where.key in settings ? { key: where.key, value: settings[where.key] } : null),
      ),
      findMany: jest.fn().mockImplementation(() =>
        Promise.resolve(Object.entries(settings).filter(([key]) => key.startsWith('trip_pricing.config.')).map(([key, value]) => ({ key, value }))),
      ),
      upsert: jest.fn().mockImplementation((args: unknown) => Promise.resolve(args)),
      deleteMany: jest.fn().mockImplementation((args: unknown) => Promise.resolve(args)),
    },
    currency: {
      findUnique: jest.fn().mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve([GNF, XOF].find((currency) => currency.id === where.id) ?? null),
      ),
      findMany: jest.fn().mockImplementation((args?: { where?: { isoCode?: { in: string[] } } }) => {
        const wanted = args?.where?.isoCode?.in;
        return Promise.resolve([GNF, XOF].filter((currency) => !wanted || wanted.includes(currency.isoCode)));
      }),
    },
    location: {
      findUnique: jest.fn().mockResolvedValue({ city: { country: { defaultCurrencyId: 'cur-gnf' } } }),
    },
    $transaction: jest.fn().mockImplementation((writes: unknown[]) => Promise.all(writes)),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const pricing = {
    distanceKmBetweenLocations: jest.fn().mockResolvedValue(options.straightKm === undefined ? 50 / 1.3 : options.straightKm),
    getNumericSetting: jest.fn().mockResolvedValue(options.factor ?? 1.3),
  };
  const service = new TripPricingService(prisma as never, audit as never, pricing as never);
  return { service, prisma, audit, pricing, settings };
}

const trip = (requested?: bigint) => ({
  originLocationId: 'loc-a',
  destinationLocationId: 'loc-b',
  currencyId: 'cur-gnf',
  requested,
});

describe('TripPricingService.decidePrice', () => {
  it('manuel (ou aucun mode enregistré) : le prix saisi est retenu tel quel, même très haut', async () => {
    const { service } = build();
    await expect(service.decidePrice(trip(9_000_000n))).resolves.toEqual({ pricePerSeat: 9_000_000n, locked: false });
  });

  it('manuel : le prix est obligatoire', async () => {
    const { service } = build({ mode: 'MANUAL' });
    await expect(service.decidePrice(trip())).rejects.toThrow('Indiquez le prix par place.');
    await expect(service.decidePrice(trip(0n))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('semi-automatique : un prix dans la fourchette est accepté', async () => {
    const { service } = build({ mode: 'SEMI_AUTO' });
    await expect(service.decidePrice(trip(36_000n))).resolves.toEqual({ pricePerSeat: 36_000n, locked: false });
  });

  it('semi-automatique : un prix SOUS le minimum reste accepté', async () => {
    const { service } = build({ mode: 'SEMI_AUTO' });
    await expect(service.decidePrice(trip(5_000n))).resolves.toEqual({ pricePerSeat: 5_000n, locked: false });
  });

  it('semi-automatique : le maximum exact passe, un franc de plus est bloqué avec les repères dans le message', async () => {
    const { service } = build({ mode: 'SEMI_AUTO' });
    await expect(service.decidePrice(trip(41_000n))).resolves.toMatchObject({ pricePerSeat: 41_000n });
    await expect(service.decidePrice(trip(41_001n))).rejects.toThrow(/Prix trop élevé.*maximum autorisé est .*41.000 GNF.*34.000 GNF/s);
  });

  it('semi-automatique : sans prix saisi, le prix conseillé est retenu', async () => {
    const { service } = build({ mode: 'SEMI_AUTO' });
    await expect(service.decidePrice(trip())).resolves.toEqual({ pricePerSeat: 34_000n, locked: false });
  });

  it('automatique : le prix de la plateforme s\'impose, ce que le conducteur a saisi est ignoré', async () => {
    const { service } = build({ mode: 'AUTO' });
    await expect(service.decidePrice(trip(9_000_000n))).resolves.toEqual({ pricePerSeat: 34_000n, locked: true });
    await expect(service.decidePrice(trip(1n))).resolves.toEqual({ pricePerSeat: 34_000n, locked: true });
    await expect(service.decidePrice(trip())).resolves.toEqual({ pricePerSeat: 34_000n, locked: true });
  });

  it('devise non configurée : le trajet reste en prix libre, même en mode automatique', async () => {
    const { service } = build({ mode: 'AUTO', configs: { xof: GNF_CONFIG } });
    await expect(service.decidePrice(trip(70_000n))).resolves.toEqual({ pricePerSeat: 70_000n, locked: false });
  });

  it('configuration abîmée en base : traitée comme non configurée', async () => {
    const { service } = build({ mode: 'AUTO', configs: { gnf: { tiers: 'oups' } } });
    await expect(service.decidePrice(trip(70_000n))).resolves.toEqual({ pricePerSeat: 70_000n, locked: false });
  });

  it('distance introuvable : l\'automatique refuse, le semi-automatique retombe sur le prix saisi', async () => {
    const auto = build({ mode: 'AUTO', straightKm: null });
    await expect(auto.service.decidePrice(trip(50_000n))).rejects.toThrow(/distance/);
    const semi = build({ mode: 'SEMI_AUTO', straightKm: null });
    await expect(semi.service.decidePrice(trip(50_000n))).resolves.toEqual({ pricePerSeat: 50_000n, locked: false });
    await expect(semi.service.decidePrice(trip())).rejects.toThrow('Indiquez le prix par place.');
  });

  it('applique le coefficient routier du réglage « trip.road_distance_factor »', async () => {
    const { service, pricing } = build({ mode: 'AUTO', straightKm: 50, factor: 1 });
    await expect(service.decidePrice(trip())).resolves.toMatchObject({ pricePerSeat: 34_000n });
    expect(pricing.getNumericSetting).toHaveBeenCalledWith('trip.road_distance_factor', 1.3);
  });
});

describe('TripPricingService.isPriceLocked / priceToApplyOnPublish', () => {
  it('seul le mode automatique verrouille les prix', async () => {
    for (const [mode, expected] of [['MANUAL', false], ['SEMI_AUTO', false], ['AUTO', true]] as const) {
      const { service } = build({ mode });
      await expect(service.isPriceLocked(trip())).resolves.toBe(expected);
    }
  });

  it('publication en automatique : renvoie le prix du jour s\'il diffère, sinon rien', async () => {
    const { service } = build({ mode: 'AUTO' });
    await expect(service.priceToApplyOnPublish({ ...trip(), pricePerSeat: 20_000n })).resolves.toBe(34_000n);
    await expect(service.priceToApplyOnPublish({ ...trip(), pricePerSeat: 34_000n })).resolves.toBeNull();
  });

  it('publication en semi-automatique : un prix devenu trop élevé bloque, sinon rien à changer', async () => {
    const { service } = build({ mode: 'SEMI_AUTO' });
    await expect(service.priceToApplyOnPublish({ ...trip(), pricePerSeat: 60_000n })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.priceToApplyOnPublish({ ...trip(), pricePerSeat: 20_000n })).resolves.toBeNull();
  });

  it('publication en manuel : rien à changer', async () => {
    const { service } = build({ mode: 'MANUAL' });
    await expect(service.priceToApplyOnPublish({ ...trip(), pricePerSeat: 60_000n })).resolves.toBeNull();
  });
});

describe('TripPricingService.guidance', () => {
  it('sans départ ni arrivée : seulement le mode', async () => {
    const { service } = build({ mode: 'AUTO' });
    await expect(service.guidance({})).resolves.toMatchObject({ mode: 'AUTO', applicable: false, reason: 'NO_ROUTE' });
    await expect(service.guidance({ originLocationId: 'loc-a' })).resolves.toMatchObject({ reason: 'NO_ROUTE' });
  });

  it('manuel : pas de conseil', async () => {
    const { service } = build({ mode: 'MANUAL' });
    await expect(service.guidance({ originLocationId: 'a', destinationLocationId: 'b' })).resolves.toMatchObject({
      mode: 'MANUAL', applicable: false, reason: 'MANUAL', suggestedPrice: null,
    });
  });

  it('semi-automatique : prix conseillé, minimum et maximum, en chaînes', async () => {
    const { service } = build({ mode: 'SEMI_AUTO' });
    await expect(service.guidance({ originLocationId: 'a', destinationLocationId: 'b' })).resolves.toEqual({
      mode: 'SEMI_AUTO',
      applicable: true,
      reason: null,
      currency: expect.objectContaining({ id: 'cur-gnf', isoCode: 'GNF', symbol: 'FG' }),
      distanceKm: 50,
      suggestedPrice: '34000',
      minPrice: '29000',
      maxPrice: '41000',
    });
  });

  it('devise non configurée ou distance inconnue : expliqué par la raison', async () => {
    const notConfigured = build({ mode: 'AUTO', configs: {} });
    await expect(notConfigured.service.guidance({ originLocationId: 'a', destinationLocationId: 'b' })).resolves.toMatchObject({
      applicable: false, reason: 'NOT_CONFIGURED',
    });
    const noDistance = build({ mode: 'AUTO', straightKm: null });
    await expect(noDistance.service.guidance({ originLocationId: 'a', destinationLocationId: 'b' })).resolves.toMatchObject({
      mode: 'AUTO', applicable: false, reason: 'NO_DISTANCE',
    });
  });
});

describe('TripPricingService.getConfig / saveConfig', () => {
  const valid = { tiers: DEFAULT_TIERS, roundingStep: 500, minPercent: 85, maxPercent: 120 };

  it('getConfig : toutes les devises, null quand elles ne sont pas configurées', async () => {
    const { service } = build({ mode: 'SEMI_AUTO' });
    const config = await service.getConfig();
    expect(config.mode).toBe('SEMI_AUTO');
    expect(config.currencies.map((currency) => [currency.isoCode, currency.config !== null])).toEqual([['GNF', true], ['XOF', false]]);
  });

  it('saveConfig : enregistre le mode et les devises dans une transaction, puis journalise', async () => {
    const { service, prisma, audit } = build();
    await service.saveConfig({ mode: 'AUTO', currencies: { GNF: valid, XOF: null } }, 'admin1');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const upserts = prisma.platformSetting.upsert.mock.calls.map(([args]) => args.where.key);
    expect(upserts).toEqual(['trip_pricing.config.gnf', 'trip_pricing.mode']);
    expect(prisma.platformSetting.deleteMany).toHaveBeenCalledWith({ where: { key: 'trip_pricing.config.xof' } });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'admin1', action: 'TRIP_PRICING_UPDATE' }));
  });

  it('saveConfig : une configuration invalide n\'écrit RIEN (pas même le mode)', async () => {
    const { service, prisma, audit } = build();
    await expect(
      service.saveConfig({ mode: 'AUTO', currencies: { GNF: valid, XOF: { ...valid, roundingStep: 0 } } }, 'admin1'),
    ).rejects.toThrow(/XOF : /);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.platformSetting.upsert).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('saveConfig : refuse un mode inconnu et une devise inconnue', async () => {
    const { service } = build();
    await expect(service.saveConfig({ mode: 'TURBO' as never, currencies: {} }, 'a')).rejects.toThrow('Mode de prix inconnu.');
    await expect(service.saveConfig({ mode: 'AUTO', currencies: { EUR: valid } }, 'a')).rejects.toThrow('Devise inconnue : EUR.');
  });
});
