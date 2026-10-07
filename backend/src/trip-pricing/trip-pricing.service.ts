// backend/src/trip-pricing/trip-pricing.service.ts
//
// Prix des trajets fixé par la plateforme (voir trip-pricing.rules.ts pour les règles). Ce service :
//   - lit et enregistre la configuration (mode + paliers par devise) dans la table des réglages (PlatformSetting) ;
//   - calcule le prix conseillé / minimum / maximum d'un trajet à partir de la distance ;
//   - décide du prix retenu à la création, à la modification et à la publication d'un trajet selon le mode.
//
// Stockage : « trip_pricing.mode » (chaîne) et « trip_pricing.config.<devise en minuscules> » (objet). Ces clés se modifient
// uniquement depuis la page « Configuration frais trajets » : l'API générique des réglages les refuse (voir
// PlatformSettingsService), afin qu'aucune configuration non vérifiée n'atteigne le calcul des prix.
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PricingService } from '../pricing/pricing.service';
import { formatMoneyWithCurrency } from '../common/utils/money.util';
import {
  CurrencyPricing,
  PriceBounds,
  PricingMode,
  checkSemiAutoPrice,
  computeBounds,
  isPricingMode,
  parseStoredCurrencyPricing,
  validateCurrencyPricing,
} from './trip-pricing.rules';

export const TRIP_PRICING_MODE_KEY = 'trip_pricing.mode';
export const TRIP_PRICING_CONFIG_PREFIX = 'trip_pricing.config.';

const DEFAULT_MODE: PricingMode = 'MANUAL';

export interface TripPricingConfigView {
  mode: PricingMode;
  currencies: Array<{
    id: string;
    isoCode: string;
    name: string;
    symbol: string | null;
    /** null = pas encore configurée : les conducteurs de cette devise fixent librement leur prix. */
    config: CurrencyPricing | null;
  }>;
}

export type GuidanceReason = 'NO_ROUTE' | 'MANUAL' | 'NOT_CONFIGURED' | 'NO_DISTANCE';

/** Ce que l'application du conducteur affiche pendant la création d'un trajet. Montants en chaînes (BigInt). */
export interface TripPriceGuidance {
  mode: PricingMode;
  /** true : un prix conseillé (et ses bornes) a pu être calculé pour ce trajet et la règle du mode s'applique. */
  applicable: boolean;
  reason: GuidanceReason | null;
  currency: { id: string; isoCode: string; symbol: string | null } | null;
  distanceKm: number | null;
  suggestedPrice: string | null;
  minPrice: string | null;
  maxPrice: string | null;
}

interface Quote {
  mode: PricingMode;
  currency: { id: string; isoCode: string; symbol: string | null };
  distanceKm: number;
  bounds: PriceBounds;
}

export interface TripPriceDecision {
  pricePerSeat: bigint;
  /** true : le prix vient de la plateforme (mode AUTO) ; le conducteur ne peut ni le fixer ni modifier les prix des étapes. */
  locked: boolean;
}

function settingKeyFor(isoCode: string): string {
  return `${TRIP_PRICING_CONFIG_PREFIX}${isoCode.toLowerCase()}`;
}

@Injectable()
export class TripPricingService {
  private readonly logger = new Logger(TripPricingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly pricing: PricingService,
  ) {}

  // ---------------------------------------------------------------------
  // Configuration (page d'administration)
  // ---------------------------------------------------------------------

  async getMode(): Promise<PricingMode> {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: TRIP_PRICING_MODE_KEY } });
    return isPricingMode(row?.value) ? row.value : DEFAULT_MODE;
  }

  private async getCurrencyConfig(isoCode: string): Promise<CurrencyPricing | null> {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: settingKeyFor(isoCode) } });
    return row ? parseStoredCurrencyPricing(row.value) : null;
  }

  async getConfig(): Promise<TripPricingConfigView> {
    const [mode, currencies, rows] = await Promise.all([
      this.getMode(),
      this.prisma.currency.findMany({ orderBy: { isoCode: 'asc' } }),
      this.prisma.platformSetting.findMany({ where: { key: { startsWith: TRIP_PRICING_CONFIG_PREFIX } } }),
    ]);
    return {
      mode,
      currencies: currencies.map((currency) => {
        const row = rows.find((item) => item.key === settingKeyFor(currency.isoCode));
        return {
          id: currency.id,
          isoCode: currency.isoCode,
          name: currency.name,
          symbol: currency.symbol,
          config: row ? parseStoredCurrencyPricing(row.value) : null,
        };
      }),
    };
  }

  /**
   * Enregistre le mode et la configuration des devises indiquées (une valeur null retire la configuration d'une devise).
   * Tout est validé AVANT la première écriture : une erreur n'enregistre rien.
   */
  async saveConfig(
    input: { mode: PricingMode; currencies: Record<string, unknown> },
    actorId: string,
  ): Promise<TripPricingConfigView> {
    if (!isPricingMode(input.mode)) throw new BadRequestException('Mode de prix inconnu.');

    const isoCodes = Object.keys(input.currencies ?? {});
    const known = await this.prisma.currency.findMany({ where: { isoCode: { in: isoCodes } }, select: { isoCode: true } });
    const knownCodes = new Set(known.map((currency) => currency.isoCode));

    // 1. Tout est validé d'abord : une devise invalide n'écrit rien, pas même les devises valides qui la précèdent.
    const validated = new Map<string, CurrencyPricing | null>();
    for (const isoCode of isoCodes) {
      if (!knownCodes.has(isoCode)) throw new BadRequestException(`Devise inconnue : ${isoCode}.`);
      const raw = input.currencies[isoCode];
      if (raw === null) {
        validated.set(isoCode, null);
        continue;
      }
      const verdict = validateCurrencyPricing(raw);
      if (!verdict.ok) throw new BadRequestException(`${isoCode} : ${verdict.error}`);
      validated.set(isoCode, verdict.value);
    }

    // 2. Puis les écritures, en une seule transaction.
    const writes: Prisma.PrismaPromise<unknown>[] = [];
    const diff: Record<string, unknown> = { mode: input.mode };
    for (const [isoCode, config] of validated) {
      diff[isoCode] = config;
      if (config === null) {
        writes.push(this.prisma.platformSetting.deleteMany({ where: { key: settingKeyFor(isoCode) } }));
        continue;
      }
      const value = config as unknown as Prisma.InputJsonValue;
      writes.push(
        this.prisma.platformSetting.upsert({
          where: { key: settingKeyFor(isoCode) },
          update: { value, updatedById: actorId },
          create: {
            key: settingKeyFor(isoCode),
            value,
            description: `Prix des trajets par paliers de distance (${isoCode})`,
            updatedById: actorId,
          },
        }),
      );
    }
    writes.push(
      this.prisma.platformSetting.upsert({
        where: { key: TRIP_PRICING_MODE_KEY },
        update: { value: input.mode, updatedById: actorId },
        create: {
          key: TRIP_PRICING_MODE_KEY,
          value: input.mode,
          description: 'Mode de fixation du prix des trajets (MANUAL, SEMI_AUTO, AUTO)',
          updatedById: actorId,
        },
      }),
    );
    await this.prisma.$transaction(writes);

    await this.audit.log({
      actorId,
      entityType: 'PlatformSetting',
      entityId: TRIP_PRICING_MODE_KEY,
      action: 'TRIP_PRICING_UPDATE',
      diff: diff as Prisma.InputJsonValue,
    });
    return this.getConfig();
  }

  // ---------------------------------------------------------------------
  // Calcul du prix
  // ---------------------------------------------------------------------

  /**
   * Distance de facturation = distance à vol d'oiseau entre départ et arrivée × coefficient routier (le même réglage que
   * pour les heures de passage, « trip.road_distance_factor »), arrondie au dixième de km. null si les adresses n'ont pas
   * de coordonnées exploitables.
   */
  private async billableDistanceKm(originLocationId: string, destinationLocationId: string): Promise<number | null> {
    const straight = await this.pricing.distanceKmBetweenLocations(originLocationId, destinationLocationId);
    if (straight === null) return null;
    const factor = await this.pricing.getNumericSetting('trip.road_distance_factor', 1.3);
    return Math.round(straight * (factor > 0 ? factor : 1.3) * 10) / 10;
  }

  /** Calcule le prix conseillé et ses bornes si le mode et la devise le permettent ; sinon dit pourquoi pas. */
  private async quote(params: {
    originLocationId: string;
    destinationLocationId: string;
    currencyId: string;
  }): Promise<{ quote: Quote } | { reason: GuidanceReason; mode: PricingMode; currency: Quote['currency'] | null }> {
    const [mode, currency] = await Promise.all([
      this.getMode(),
      this.prisma.currency.findUnique({ where: { id: params.currencyId }, select: { id: true, isoCode: true, symbol: true } }),
    ]);
    if (!currency) return { reason: 'NOT_CONFIGURED', mode, currency: null };
    if (mode === 'MANUAL') return { reason: 'MANUAL', mode, currency };

    const config = await this.getCurrencyConfig(currency.isoCode);
    if (!config) return { reason: 'NOT_CONFIGURED', mode, currency };

    const distanceKm = await this.billableDistanceKm(params.originLocationId, params.destinationLocationId);
    if (distanceKm === null) return { reason: 'NO_DISTANCE', mode, currency };

    return { quote: { mode, currency, distanceKm, bounds: computeBounds(distanceKm, config) } };
  }

  /**
   * Pour l'écran « Créer un trajet » : le mode en vigueur et, si possible, le prix conseillé et ses bornes. Sans départ ni
   * arrivée, seul le mode est renvoyé (l'écran sait déjà s'il doit proposer un champ de prix ou non).
   */
  async guidance(params: { originLocationId?: string; destinationLocationId?: string }): Promise<TripPriceGuidance> {
    const empty = (mode: PricingMode, reason: GuidanceReason, currency: Quote['currency'] | null = null): TripPriceGuidance => ({
      mode,
      applicable: false,
      reason,
      currency,
      distanceKm: null,
      suggestedPrice: null,
      minPrice: null,
      maxPrice: null,
    });

    if (!params.originLocationId || !params.destinationLocationId) return empty(await this.getMode(), 'NO_ROUTE');

    const currencyId = await this.currencyIdOfLocation(params.originLocationId);
    if (!currencyId) return empty(await this.getMode(), 'NOT_CONFIGURED');

    const result = await this.quote({
      originLocationId: params.originLocationId,
      destinationLocationId: params.destinationLocationId,
      currencyId,
    });
    if (!('quote' in result)) return empty(result.mode, result.reason, result.currency);

    const { quote } = result;
    return {
      mode: quote.mode,
      applicable: true,
      reason: null,
      currency: quote.currency,
      distanceKm: quote.distanceKm,
      suggestedPrice: quote.bounds.suggested.toString(),
      minPrice: quote.bounds.min.toString(),
      maxPrice: quote.bounds.max.toString(),
    };
  }

  /** Devise du pays de la ville de l'adresse de départ (la même règle que la création d'un trajet). */
  private async currencyIdOfLocation(locationId: string): Promise<string | null> {
    const location = await this.prisma.location.findUnique({
      where: { id: locationId },
      select: { city: { select: { country: { select: { defaultCurrencyId: true } } } } },
    });
    return location?.city?.country?.defaultCurrencyId ?? null;
  }

  // ---------------------------------------------------------------------
  // Décision à la création / modification / publication d'un trajet
  // ---------------------------------------------------------------------

  /**
   * Prix retenu pour un trajet.
   *   - MANUAL, ou devise non configurée : le prix saisi, obligatoire ;
   *   - SEMI_AUTO : le prix saisi (à défaut, le prix conseillé), refusé s'il dépasse le maximum ; un prix bas est accepté ;
   *   - AUTO : toujours le prix conseillé, ce que le conducteur a saisi est ignoré.
   * Si la distance ne peut pas être calculée : AUTO refuse (aucun prix possible), SEMI_AUTO retombe sur le prix saisi.
   */
  async decidePrice(params: {
    originLocationId: string;
    destinationLocationId: string;
    currencyId: string;
    requested?: bigint;
  }): Promise<TripPriceDecision> {
    const result = await this.quote(params);

    if (!('quote' in result)) {
      if (result.mode === 'AUTO' && result.reason === 'NO_DISTANCE') {
        throw new BadRequestException(
          "Le prix de ce trajet est calculé par Occa'Z à partir de la distance, mais elle n'a pas pu être déterminée. Choisissez des adresses localisées sur la carte.",
        );
      }
      if (result.reason === 'NO_DISTANCE') {
        this.logger.warn('Distance introuvable : le prix saisi par le conducteur est retenu sans plafond (mode semi-automatique).');
      }
      return { pricePerSeat: this.requirePrice(params.requested), locked: false };
    }

    const { quote } = result;
    if (quote.mode === 'AUTO') return { pricePerSeat: quote.bounds.suggested, locked: true };

    // SEMI_AUTO
    const price = params.requested ?? quote.bounds.suggested;
    const verdict = checkSemiAutoPrice(price, quote.bounds);
    if (!verdict.ok) {
      const iso = quote.currency.isoCode;
      throw new BadRequestException(
        `Prix trop élevé pour ce trajet : le maximum autorisé est ${formatMoneyWithCurrency(verdict.max, iso)} par place (prix conseillé : ${formatMoneyWithCurrency(verdict.suggested, iso)}).`,
      );
    }
    return { pricePerSeat: price, locked: false };
  }

  private requirePrice(requested?: bigint): bigint {
    if (requested === undefined || requested <= 0n) throw new BadRequestException('Indiquez le prix par place.');
    return requested;
  }

  /** Vrai si les prix de ce trajet (et de ses étapes) sont fixés par la plateforme : le conducteur ne peut pas les modifier. */
  async isPriceLocked(params: { originLocationId: string; destinationLocationId: string; currencyId: string }): Promise<boolean> {
    const result = await this.quote(params);
    return 'quote' in result && result.quote.mode === 'AUTO';
  }

  /**
   * Au moment de publier : le trajet est en brouillon depuis un moment, la configuration a pu changer. En AUTO, le prix est
   * remis au prix du jour (renvoyé si différent) ; en SEMI_AUTO, un prix devenu trop élevé bloque la publication.
   */
  async priceToApplyOnPublish(trip: {
    originLocationId: string;
    destinationLocationId: string;
    currencyId: string;
    pricePerSeat: bigint;
  }): Promise<bigint | null> {
    const decision = await this.decidePrice({
      originLocationId: trip.originLocationId,
      destinationLocationId: trip.destinationLocationId,
      currencyId: trip.currencyId,
      requested: trip.pricePerSeat,
    });
    return decision.locked && decision.pricePerSeat !== trip.pricePerSeat ? decision.pricePerSeat : null;
  }
}
