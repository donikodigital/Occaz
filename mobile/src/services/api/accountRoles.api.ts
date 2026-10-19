// mobile/src/services/api/accountRoles.api.ts
// [19/10/2026] v1 — Espaces du compte (passager / conducteur) et état du dossier du conducteur.
import { api } from './client';
import type { AccountRoles, DriverCompliance } from '@/types/roles.types';

export const accountRolesApi = {
  getRoles: () => api.get<AccountRoles>('/account/roles'),

  /** Un conducteur ouvre son espace passager : le code PIN de connexion est demandé. */
  activateCustomer: (pin: string) => api.post<AccountRoles>('/account/roles/customer', { pin }),

  getDriverCompliance: () => api.get<DriverCompliance>('/driver-profiles/me/compliance'),
};
