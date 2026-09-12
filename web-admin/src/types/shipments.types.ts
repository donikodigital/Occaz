// web-admin/src/types/shipments.types.ts
import type { Money } from '@/services/api/types';

export interface ShipmentContext {
  id: string;
  customerId: string;
  senderName: string;
  recipientName: string;
  totalAmount: Money;
  currencyId: string;
  status: string;
  category?: { name: string };
  trip?: { id: string; driver?: { firstName: string; lastName: string } } | null;
}
