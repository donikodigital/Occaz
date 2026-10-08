// backend/src/wallets/providers/payout-provider.registry.ts
import { Injectable, Logger } from '@nestjs/common';
import { PayoutProvider } from './payout-provider.interface';
import { SimulatedPayoutProvider } from './simulated-payout.provider';
import { OrangeMoneyPayoutProvider, readOrangeMoneyConfig } from './orange-money-payout.provider';

/**
 * Choisit l'adaptateur de retrait selon PAYOUT_PROVIDER (« simulated » par défaut). Avec PAYOUT_PROVIDER=orange_money, l'adaptateur
 * Orange Money est utilisé SEULEMENT si toute sa configuration est présente (voir orange-money-payout.provider.ts) ; sinon on reste
 * sur la simulation — en production, les retraits se font alors à la main — et on le dit dans les logs.
 */
@Injectable()
export class PayoutProviderRegistry {
  private readonly logger = new Logger(PayoutProviderRegistry.name);

  private orangeMoney: OrangeMoneyPayoutProvider | null = null;

  constructor(private readonly simulated: SimulatedPayoutProvider) {}

  get(): PayoutProvider {
    const wanted = (process.env.PAYOUT_PROVIDER ?? 'simulated').trim().toLowerCase();
    switch (wanted) {
      case 'simulated':
        return this.simulated;
      case 'orange_money': {
        if (this.orangeMoney) return this.orangeMoney;
        const { config, missing } = readOrangeMoneyConfig();
        if (!config) {
          this.logger.error(`PAYOUT_PROVIDER=orange_money mais configuration incomplète (manque : ${missing.join(', ')}) : prestataire simulé utilisé.`);
          return this.simulated;
        }
        this.orangeMoney = new OrangeMoneyPayoutProvider(config);
        return this.orangeMoney;
      }
      default:
        // Une valeur inconnue ne doit jamais faire partir de l'argent par un autre canal : on reste sur la simulation et on le dit.
        this.logger.error(`PAYOUT_PROVIDER « ${wanted} » inconnu : prestataire simulé utilisé (aucun virement réel).`);
        return this.simulated;
    }
  }
}