// backend/src/common/utils/platform-earnings.ts
// [16/10/2026] v1 — Les gains de la plateforme (commissions) ne regardent que l'administration et la finance. Un compte Support (service
// client) voit ce que le client a payé, jamais ce que la plateforme en retire : sans cette règle, « montant payé − gain du conducteur »
// révélait la commission sur chaque envoi.
import { AccountType } from '@prisma/client';
import { PERMISSIONS } from '../constants/permissions.constants';
import type { AuthenticatedUser } from '../types/request-with-user.interface';

/** Permissions qui ouvrent la vue financière de la plateforme (n'importe laquelle suffit). */
const FINANCE_PERMISSIONS: string[] = [
  PERMISSIONS.DASHBOARD_ADMIN_READ,
  PERMISSIONS.PLATFORM_WALLET_READ,
  PERMISSIONS.COMMISSION_MANAGE,
  PERMISSIONS.PAYOUT_MANAGE,
];

/** Vrai si ce compte a le droit de voir les commissions et gains de la plateforme. */
export function canSeePlatformEarnings(user: Pick<AuthenticatedUser, 'accountType' | 'permissions'>): boolean {
  if (user.accountType === AccountType.SUPERADMIN) return true;
  return user.permissions.some((permission) => FINANCE_PERMISSIONS.includes(permission));
}

function omitKeys<T>(value: T, keys: string[]): T {
  if (!value || typeof value !== 'object') return value;
  const copy = { ...(value as Record<string, unknown>) };
  for (const key of keys) delete copy[key];
  return copy as T;
}

/** Copie de l'objet sans sa commission (`platformFee`) ; renvoie l'objet tel quel s'il n'en a pas. */
export function withoutPlatformFee<T>(value: T): T {
  return omitKeys(value, ['platformFee']);
}

/** Copie d'un profil conducteur sans son portefeuille (solde, solde en attente) : l'argent du conducteur n'est pas l'affaire du support. */
export function withoutWallet<T>(value: T): T {
  return omitKeys(value, ['wallet']);
}

/** Litige sans les commissions de la réservation / de l'envoi concerné. */
export function withoutDisputeFinance<T>(dispute: T): T {
  if (!dispute || typeof dispute !== 'object') return dispute;
  const source = dispute as Record<string, unknown>;
  return {
    ...source,
    ...(source.booking ? { booking: withoutPlatformFee(source.booking) } : {}),
    ...(source.shipment ? { shipment: withoutPlatformFee(source.shipment) } : {}),
  } as T;
}
