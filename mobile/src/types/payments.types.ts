// mobile/src/types/payments.types.ts
export type PaymentProviderType = 'ORANGE_MONEY' | 'MOBILE_MONEY_XOF' | 'CARD' | 'BANK_TRANSFER' | 'OTHER';

export interface PaymentProvider {
  id: string;
  type: PaymentProviderType;
  name: string;
  countryId: string | null;
  isActive: boolean;
}

export interface InitiatePaymentPayload {
  bookingId?: string;
  shipmentId?: string;
  providerId: string;
}

export interface InitiatePaymentResult {
  paymentId: string;
  transactionId: string;
  externalReference?: string;
  amount: string;
  currencyId: string;
  providerType: PaymentProviderType;
  redirectUrl?: string;
  instructions?: string;
}
