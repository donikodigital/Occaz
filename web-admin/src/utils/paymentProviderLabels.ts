// web-admin/src/utils/paymentProviderLabels.ts
import type { PaymentProviderType } from '@/types/paymentProviders.types';

export const PAYMENT_PROVIDER_TYPE_LABELS: Record<PaymentProviderType, string> = {
  ORANGE_MONEY: 'Orange Money',
  MOBILE_MONEY_XOF: 'Mobile Money (zone XOF)',
  CARD: 'Carte bancaire',
  BANK_TRANSFER: 'Virement bancaire',
  OTHER: 'Autre',
};
