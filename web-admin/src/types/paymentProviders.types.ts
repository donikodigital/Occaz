// web-admin/src/types/paymentProviders.types.ts
export type PaymentProviderType = 'ORANGE_MONEY' | 'MOBILE_MONEY_XOF' | 'CARD' | 'BANK_TRANSFER' | 'OTHER';

export interface PaymentProvider {
  id: string;
  type: PaymentProviderType;
  name: string;
  countryId: string | null;
  isActive: boolean;
  config: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentProviderPayload {
  type: PaymentProviderType;
  name: string;
  countryId?: string;
  config?: Record<string, unknown>;
}

export type UpdatePaymentProviderPayload = Partial<CreatePaymentProviderPayload>;
