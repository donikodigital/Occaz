// web-admin/src/utils/tripPricing.ts
//
// Calcul et validation des paliers de prix des trajets, côté navigateur : sert à l'aperçu en direct de la page « Configuration
// frais trajets » et à signaler une erreur de saisie avant l'envoi. Les règles font foi côté serveur
// (backend/src/trip-pricing/trip-pricing.rules.ts) : toute modification ici doit y être reportée.
import type { CurrencyPricing, PricingTier } from '@/types/tripPricing.types';

export const DEFAULT_TIERS: PricingTier[] = [
  { upToKm: 10, pricePerKm: 1000 },
  { upToKm: 30, pricePerKm: 700 },
  { upToKm: 70, pricePerKm: 500 },
  { upToKm: null, pricePerKm: 500 },
];

export const MAX_TIERS = 10;

/** Saisie en cours : des chaînes, pour laisser un champ vide ou à moitié tapé sans le « corriger » sous les doigts. */
export interface TierDraft {
  upToKm: string; // vide pour la dernière tranche
  pricePerKm: string;
}

export interface PricingDraft {
  tiers: TierDraft[];
  roundingStep: string;
  minPercent: string;
  maxPercent: string;
}

export function suggestedRoundingStep(isoCode: string): number {
  if (isoCode === 'GNF') return 500;
  if (isoCode === 'XOF' || isoCode === 'XAF') return 25;
  return 100;
}

export function draftFromConfig(config: CurrencyPricing): PricingDraft {
  return {
    tiers: config.tiers.map((tier) => ({
      upToKm: tier.upToKm === null ? '' : String(tier.upToKm),
      pricePerKm: String(tier.pricePerKm),
    })),
    roundingStep: String(config.roundingStep),
    minPercent: String(config.minPercent),
    maxPercent: String(config.maxPercent),
  };
}

export function defaultDraft(isoCode: string): PricingDraft {
  return draftFromConfig({ tiers: DEFAULT_TIERS, roundingStep: suggestedRoundingStep(isoCode), minPercent: 85, maxPercent: 120 });
}

function parseNumber(raw: string): number {
  return Number(raw.trim().replace(/\s/g, '').replace(',', '.'));
}

/** Convertit la saisie en configuration, ou dit précisément ce qui ne va pas (mêmes règles que le serveur). */
export function configFromDraft(draft: PricingDraft): { ok: true; value: CurrencyPricing } | { ok: false; error: string } {
  if (draft.tiers.length === 0) return { ok: false, error: 'Ajoutez au moins un palier.' };
  if (draft.tiers.length > MAX_TIERS) return { ok: false, error: `Au plus ${MAX_TIERS} paliers.` };

  const tiers: PricingTier[] = [];
  let previousEnd = 0;
  for (const [index, tier] of draft.tiers.entries()) {
    const isLast = index === draft.tiers.length - 1;
    const label = `Palier ${index + 1}`;

    const pricePerKm = parseNumber(tier.pricePerKm);
    if (!tier.pricePerKm.trim() || !Number.isInteger(pricePerKm) || pricePerKm < 1) {
      return { ok: false, error: `${label} : le prix du kilomètre doit être un nombre entier supérieur à zéro.` };
    }
    if (isLast) {
      tiers.push({ upToKm: null, pricePerKm });
      continue;
    }
    const upToKm = parseNumber(tier.upToKm);
    if (!tier.upToKm.trim() || !Number.isFinite(upToKm) || upToKm <= previousEnd) {
      return { ok: false, error: `${label} : la fin du palier doit être supérieure à ${previousEnd} km.` };
    }
    tiers.push({ upToKm, pricePerKm });
    previousEnd = upToKm;
  }

  const roundingStep = parseNumber(draft.roundingStep);
  if (!draft.roundingStep.trim() || !Number.isInteger(roundingStep) || roundingStep < 1) {
    return { ok: false, error: "L'arrondi doit être un nombre entier supérieur à zéro." };
  }
  const minPercent = parseNumber(draft.minPercent);
  if (!draft.minPercent.trim() || !Number.isFinite(minPercent) || minPercent < 1 || minPercent > 100) {
    return { ok: false, error: 'Le minimum conseillé doit être compris entre 1 % et 100 % du prix conseillé.' };
  }
  const maxPercent = parseNumber(draft.maxPercent);
  if (!draft.maxPercent.trim() || !Number.isFinite(maxPercent) || maxPercent < 100 || maxPercent > 500) {
    return { ok: false, error: 'Le maximum autorisé doit être compris entre 100 % et 500 % du prix conseillé.' };
  }
  return { ok: true, value: { tiers, roundingStep, minPercent, maxPercent } };
}

/** Prix brut d'une distance : chaque tranche de kilomètres est facturée à son propre tarif (comme une tranche d'impôt). */
export function computeTieredAmount(distanceKm: number, tiers: PricingTier[]): number {
  if (!(distanceKm > 0) || tiers.length === 0) return 0;
  let remaining = distanceKm;
  let lowerBound = 0;
  let total = 0;
  for (const tier of tiers) {
    const width = tier.upToKm === null ? remaining : Math.min(remaining, tier.upToKm - lowerBound);
    if (width > 0) {
      total += width * tier.pricePerKm;
      remaining -= width;
    }
    if (tier.upToKm === null || remaining <= 0) break;
    lowerBound = tier.upToKm;
  }
  if (remaining > 0) total += remaining * tiers[tiers.length - 1].pricePerKm;
  return total;
}

function roundToStep(value: number, step: number): number {
  return Math.max(1, Math.round(value / step)) * step;
}

export interface PriceBounds {
  suggested: number;
  min: number;
  max: number;
}

export function computeBounds(distanceKm: number, config: CurrencyPricing): PriceBounds {
  const raw = computeTieredAmount(distanceKm, config.tiers);
  const suggested = roundToStep(raw, config.roundingStep);
  const min = roundToStep(raw * (config.minPercent / 100), config.roundingStep);
  const max = roundToStep(raw * (config.maxPercent / 100), config.roundingStep);
  return { suggested, min: Math.min(min, suggested), max: Math.max(max, suggested) };
}
