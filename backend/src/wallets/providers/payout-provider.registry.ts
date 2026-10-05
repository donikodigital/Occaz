// backend/src/wallets/providers/payout-provider.registry.ts
import { Injectable, Logger } from '@nestjs/common';
import { PayoutProvider } from './payout-provider.interface';
import { SimulatedPayoutProvider } from './simulated-payout.provider';

/**
 * Choisit l'adaptateur de retrait selon PAYOUT_PROVIDER (« simulated » par défaut). Quand l'adaptateur Orange Money existera, on
 * l'ajoute ici — un `case 'orange_money'` — sans toucher à PayoutsService.
 */
@Injectable()
export class PayoutProviderRegistry {
  private readonly logger = new Logger(PayoutProviderRegistry.name);

  constructor(private readonly simulated: SimulatedPayoutProvider) {}

  get(): PayoutProvider {
    const wanted = (process.env.PAYOUT_PROVIDER ?? 'simulated').trim().toLowerCase();
    switch (wanted) {
      case 'simulated':
        return this.simulated;
      default:
        // Une valeur inconnue ne doit jamais faire partir de l'argent par un autre canal : on reste sur la simulation et on le dit.
        this.logger.error(`PAYOUT_PROVIDER « ${wanted} » inconnu : prestataire simulé utilisé (aucun virement réel).`);
        return this.simulated;
    }
  }
}
