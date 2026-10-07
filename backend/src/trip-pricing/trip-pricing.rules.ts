// backend/src/trip-pricing/trip-pricing.rules.ts
//
// Règles pures (ni base de données, ni réseau) du prix des trajets fixé par la plateforme.
//
// Trois modes, choisis par le SuperAdmin :
//   - MANUAL    : le conducteur fixe librement son prix (comportement historique) ;
//   - SEMI_AUTO : la plateforme calcule un prix conseillé et un prix MAXIMUM. Au-delà du maximum, le prix est refusé. En
//                 dessous du minimum conseillé, il est accepté : le minimum n'est qu'un repère affiché au conducteur ;
//   - AUTO      : le prix est celui de la plateforme, le conducteur ne peut pas le modifier.
//
// Le prix se calcule par paliers de distance, PROGRESSIFS : chaque tranche de kilomètres est facturée à son propre tarif
// (10 premiers km à 1 000, les 20 suivants à 700, etc.), comme une tranche d'impôt. Avec un tarif unique appliqué à toute la
// distance, un trajet de 31 km coûterait moins cher qu'un trajet de 30 km — incohérent pour le conducteur comme pour le client.

export const PRICING_MODES = ['MANUAL', 'SEMI_AUTO', 'AUTO'] as const;
export type PricingMode = (typeof PRICING_MODES)[number];

export interface PricingTier {
  /** Fin de la tranche en km (incluse) ; null = sans limite, uniquement pour la dernière tranche. */
  upToKm: number | null;
  /** Prix du kilomètre dans cette tranche, en unité entière de la devise (GNF, XOF…). */
  pricePerKm: number;
}

export interface CurrencyPricing {
  tiers: PricingTier[];
  /** Les prix sont arrondis à ce multiple (500 pour GNF, 25 ou 5 pour XOF selon l'usage). */
  roundingStep: number;
  /** Prix minimum conseillé, en % du prix conseillé (ex. 85). Repère seulement : un prix plus bas reste accepté. */
  minPercent: number;
  /** Prix maximum autorisé en mode semi-automatique, en % du prix conseillé (ex. 120). */
  maxPercent: number;
}

export interface PriceBounds {
  suggested: bigint;
  min: bigint;
  max: bigint;
}

export const LIMITS = {
  maxTiers: 10,
  maxPricePerKm: 10_000_000,
  maxKm: 100_000,
  maxRoundingStep: 100_000,
  maxMaxPercent: 500,
} as const;

/** Réglage de départ proposé à l'administration, dans la monnaie où les kilomètres coûtent ces montants. */
export const DEFAULT_TIERS: PricingTier[] = [
  { upToKm: 10, pricePerKm: 1000 },
  { upToKm: 30, pricePerKm: 700 },
  { upToKm: 70, pricePerKm: 500 },
  { upToKm: null, pricePerKm: 500 },
];

export function isPricingMode(value: unknown): value is PricingMode {
  return typeof value === 'string' && (PRICING_MODES as readonly string[]).includes(value);
}

/**
 * Prix brut (non arrondi) d'une distance : somme, tranche par tranche, des kilomètres de la tranche × son tarif.
 * Les tranches doivent être rangées par fin croissante (voir validateCurrencyPricing).
 */
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
  // Distance au-delà de la dernière tranche bornée (configuration sans tranche ouverte) : elle garde le dernier tarif.
  if (remaining > 0) total += remaining * tiers[tiers.length - 1].pricePerKm;
  return total;
}

function roundToStep(value: number, step: number): bigint {
  const steps = Math.round(value / step);
  return BigInt(Math.max(1, steps)) * BigInt(step);
}

/** Prix conseillé, minimum conseillé et maximum autorisé pour une distance. Toujours au moins un pas d'arrondi. */
export function computeBounds(distanceKm: number, config: CurrencyPricing): PriceBounds {
  const raw = computeTieredAmount(distanceKm, config.tiers);
  const suggested = roundToStep(raw, config.roundingStep);
  const min = roundToStep(raw * (config.minPercent / 100), config.roundingStep);
  const max = roundToStep(raw * (config.maxPercent / 100), config.roundingStep);
  return {
    suggested,
    // Garde-fous contre un arrondi qui ferait sortir le conseillé de sa fourchette.
    min: min > suggested ? suggested : min,
    max: max < suggested ? suggested : max,
  };
}

export type PriceVerdict = { ok: true } | { ok: false; max: bigint; suggested: bigint };

/** SEMI_AUTO : seul le maximum est bloquant. Un prix sous le minimum conseillé reste valable. */
export function checkSemiAutoPrice(price: bigint, bounds: PriceBounds): PriceVerdict {
  if (price <= bounds.max) return { ok: true };
  return { ok: false, max: bounds.max, suggested: bounds.suggested };
}

// ---------------------------------------------------------------------------
// Validation de la configuration saisie dans l'administration
// ---------------------------------------------------------------------------

export function validateCurrencyPricing(input: unknown): { ok: true; value: CurrencyPricing } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Configuration manquante.' };
  const raw = input as Record<string, unknown>;

  const tiersRaw = raw.tiers;
  if (!Array.isArray(tiersRaw) || tiersRaw.length === 0) return { ok: false, error: 'Ajoutez au moins une tranche de kilomètres.' };
  if (tiersRaw.length > LIMITS.maxTiers) return { ok: false, error: `Au plus ${LIMITS.maxTiers} tranches.` };

  const tiers: PricingTier[] = [];
  let previousEnd = 0;
  for (const [index, item] of tiersRaw.entries()) {
    const tier = (item ?? {}) as Record<string, unknown>;
    const isLast = index === tiersRaw.length - 1;
    const label = `Tranche ${index + 1}`;

    const pricePerKm = tier.pricePerKm;
    if (typeof pricePerKm !== 'number' || !Number.isInteger(pricePerKm) || pricePerKm < 1 || pricePerKm > LIMITS.maxPricePerKm) {
      return { ok: false, error: `${label} : le prix du kilomètre doit être un nombre entier supérieur à zéro.` };
    }

    const upToKm = tier.upToKm;
    if (isLast) {
      if (upToKm !== null && upToKm !== undefined) {
        return { ok: false, error: `${label} : la dernière tranche n'a pas de limite (« au-delà de ${previousEnd} km »).` };
      }
      tiers.push({ upToKm: null, pricePerKm });
    } else {
      if (typeof upToKm !== 'number' || !Number.isFinite(upToKm) || upToKm <= previousEnd || upToKm > LIMITS.maxKm) {
        return {
          ok: false,
          error: `${label} : la fin de tranche doit être supérieure à ${previousEnd} km (et au plus ${LIMITS.maxKm} km).`,
        };
      }
      tiers.push({ upToKm, pricePerKm });
      previousEnd = upToKm;
    }
  }

  const roundingStep = raw.roundingStep;
  if (typeof roundingStep !== 'number' || !Number.isInteger(roundingStep) || roundingStep < 1 || roundingStep > LIMITS.maxRoundingStep) {
    return { ok: false, error: "L'arrondi doit être un nombre entier supérieur à zéro." };
  }
  const minPercent = raw.minPercent;
  if (typeof minPercent !== 'number' || !Number.isFinite(minPercent) || minPercent < 1 || minPercent > 100) {
    return { ok: false, error: 'Le minimum conseillé doit être compris entre 1 % et 100 % du prix conseillé.' };
  }
  const maxPercent = raw.maxPercent;
  if (typeof maxPercent !== 'number' || !Number.isFinite(maxPercent) || maxPercent < 100 || maxPercent > LIMITS.maxMaxPercent) {
    return { ok: false, error: `Le maximum autorisé doit être compris entre 100 % et ${LIMITS.maxMaxPercent} % du prix conseillé.` };
  }

  return { ok: true, value: { tiers, roundingStep, minPercent, maxPercent } };
}

/**
 * Relit une configuration stockée en base. Une valeur abîmée (modifiée à la main dans la table des réglages, par exemple)
 * est traitée comme « non configurée » plutôt que de produire un prix absurde.
 */
export function parseStoredCurrencyPricing(value: unknown): CurrencyPricing | null {
  const verdict = validateCurrencyPricing(value);
  return verdict.ok ? verdict.value : null;
}
