// backend/src/payments/providers/payment-provider-registry.service.ts
import { Injectable } from '@nestjs/common';
import { PaymentProviderType } from '@prisma/client';
import { SimulatedPaymentProvider } from './simulated-payment.provider';
import { PaymentProviderAdapter } from './payment-provider-adapter.interface';

/**
 * Point de composition unique : c'est ici, et seulement ici, que le
 * choix d'implémentation par type de prestataire est fait. Remplacer une
 * ligne de cette table par un vrai adaptateur (OrangeMoneyProvider...)
 * n'impacte aucun autre fichier.
 */
@Injectable()
export class PaymentProviderRegistry {
  constructor(private readonly simulated: SimulatedPaymentProvider) {}

  resolve(type: PaymentProviderType): PaymentProviderAdapter {
    switch (type) {
      case PaymentProviderType.ORANGE_MONEY:
      case PaymentProviderType.MOBILE_MONEY_XOF:
      case PaymentProviderType.CARD:
      case PaymentProviderType.BANK_TRANSFER:
      case PaymentProviderType.OTHER:
      default:
        // Tous les types pointent vers la simulation tant qu'aucune
        // intégration réelle n'est développée — voir SimulatedPaymentProvider.
        return this.simulated;
    }
  }
}
