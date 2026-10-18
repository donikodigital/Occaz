// web-admin/src/hooks/usePermissions.ts
// [16/10/2026] v+ — `canSeeEarnings` : vrai pour qui a une permission financière (tableau de bord admin, portefeuille plateforme, commissions,
// retraits). Le service client ne l'a pas : il ne voit ni commissions ni gains. Le serveur retire de toute façon ces montants des réponses.
// [02/10/2026] Droits du compte connecté pour le back-office. Le SuperAdmin a tout (comme côté serveur,
// voir PermissionsGuard) ; un compte Support n'a que les permissions de ses rôles.
'use client';

import { useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { PERMISSIONS, type PermissionKey } from '@/utils/permissions';

export function usePermissions() {
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = user?.accountType === 'SUPERADMIN';
  /** Faux tant que /users/me n'a pas renvoyé les permissions (juste après la connexion). */
  const isReady = isSuperAdmin || user?.permissions !== undefined;
  const granted = user?.permissions;

  /** Vrai si le compte a AU MOINS UNE des permissions demandées. Sans argument : vrai. */
  const can = useCallback(
    (...required: PermissionKey[]): boolean => {
      if (required.length === 0) return true;
      if (isSuperAdmin) return true;
      if (!granted) return false;
      return required.some((permission) => granted.includes(permission));
    },
    [isSuperAdmin, granted],
  );

  /** Peut voir les commissions et gains de la plateforme (réservé à l'administration et à la finance). */
  const canSeeEarnings = can(
    PERMISSIONS.DASHBOARD_ADMIN_READ,
    PERMISSIONS.PLATFORM_WALLET_READ,
    PERMISSIONS.COMMISSION_MANAGE,
    PERMISSIONS.PAYOUT_MANAGE,
  );

  return { can, canSeeEarnings, isSuperAdmin, isReady, user };
}