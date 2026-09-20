// backend/src/pricing/exchange-rate.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CurrencyConversionInfo {
  fromCurrencyId: string;
  fromIsoCode: string;
  /** Montants en chaîne (BigInt sérialisé) — jamais number, mêmes conventions que le reste de l'app financière. */
  fromAmount: string;
  toCurrencyId: string;
  toIsoCode: string;
  toAmount: string;
  rate: number;
  convertedAt: string;
}

export interface ConversionResult {
  amount: bigint;
  /** null si aucune conversion n'était nécessaire (devises identiques) — c'est le cas normal pour un trajet non transfrontalier. */
  conversion: CurrencyConversionInfo | null;
}

/**
 * Conversion entre devises au moment où un montant payé change de
 * "conteneur" financier — typiquement : un chauffeur inscrit en Guinée
 * (wallet en GNF) transporte un client qui paie en XOF ; le montant
 * crédité à son solde est converti au taux configuré, jamais laissé tel
 * quel (1 GNF ≠ 1 XOF).
 *
 * Le taux est lu dans PlatformSetting, sous la clé
 * "exchange_rate.<from_iso_minuscule>_<to_iso_minuscule>" (ex:
 * "exchange_rate.xof_gnf"), configurable par le SuperAdmin depuis la
 * page Paramètres plateforme existante, sans déploiement — même
 * mécanisme que PricingService.getNumericSetting pour les autres
 * paramètres financiers (tarifs d'envoi, rayon de recherche...).
 *
 * Minuscules obligatoires dans la clé : la validation de
 * UpsertPlatformSettingDto n'accepte que [a-z0-9_], alors que
 * Currency.isoCode est stocké en majuscules (XOF, GNF) — normalisé ici.
 *
 * Aucun taux configuré = erreur explicite, jamais un repli silencieux
 * sur 1:1 (qui serait une perte ou un gain de change non maîtrisé).
 */
@Injectable()
export class ExchangeRateService {
  constructor(private readonly prisma: PrismaService) {}

  async convert(amount: bigint, fromCurrencyId: string, toCurrencyId: string): Promise<ConversionResult> {
    if (fromCurrencyId === toCurrencyId) {
      return { amount, conversion: null };
    }

    const [fromCurrency, toCurrency] = await Promise.all([
      this.prisma.currency.findUniqueOrThrow({ where: { id: fromCurrencyId } }),
      this.prisma.currency.findUniqueOrThrow({ where: { id: toCurrencyId } }),
    ]);

    const rate = await this.getRate(fromCurrency.isoCode, toCurrency.isoCode);
    // Conversion via Number : même limite/justification que
    // PricingService.computeCommission — sûre tant que le montant reste
    // dans la plage des entiers sûrs JS (2^53), largement suffisant pour
    // des montants unitaires GNF/XOF.
    const convertedAmount = BigInt(Math.round(Number(amount) * rate));

    return {
      amount: convertedAmount,
      conversion: {
        fromCurrencyId,
        fromIsoCode: fromCurrency.isoCode,
        fromAmount: amount.toString(),
        toCurrencyId,
        toIsoCode: toCurrency.isoCode,
        toAmount: convertedAmount.toString(),
        rate,
        convertedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Lit "exchange_rate.<from>_<to>" ; si absent, tente l'inverse de
   * "exchange_rate.<to>_<from>" (1 / taux) pour éviter d'obliger le
   * SuperAdmin à saisir chaque paire dans les deux sens. Échoue
   * explicitement si ni l'un ni l'autre n'existe, ou si la valeur
   * trouvée n'est pas un nombre strictement positif (protection contre
   * une erreur de saisie qui créditerait 0 ou un montant négatif).
   */
  private async getRate(fromIsoCode: string, toIsoCode: string): Promise<number> {
    const fromKey = fromIsoCode.toLowerCase();
    const toKey = toIsoCode.toLowerCase();

    const directKey = `exchange_rate.${fromKey}_${toKey}`;
    const direct = await this.prisma.platformSetting.findUnique({ where: { key: directKey } });
    if (typeof direct?.value === 'number' && direct.value > 0) return direct.value;

    const inverseKey = `exchange_rate.${toKey}_${fromKey}`;
    const inverse = await this.prisma.platformSetting.findUnique({ where: { key: inverseKey } });
    if (typeof inverse?.value === 'number' && inverse.value > 0) return 1 / inverse.value;

    throw new NotFoundException(
      `Aucun taux de change configuré entre ${fromIsoCode} et ${toIsoCode} — un SuperAdmin doit créer le paramètre "${directKey}" (page Paramètres plateforme).`,
    );
  }
}