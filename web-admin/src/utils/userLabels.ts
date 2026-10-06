// web-admin/src/utils/userLabels.ts
import type { AccountType } from '@/types/auth.types';

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CUSTOMER: 'Client',
  DRIVER: 'Conducteur',
  SUPPORT: 'Support',
  SUPERADMIN: 'SuperAdmin',
};
