// mobile/src/types/roles.types.ts
// [19/10/2026] v1 — Un seul compte (un numéro, un code PIN) peut avoir un espace passager ET un espace conducteur.
import type { AccountType } from '@/types/auth.types';

/** Les deux espaces de l'application. */
export type Space = 'CUSTOMER' | 'DRIVER';

/** Miroir de GET /account/roles : quels espaces ce compte possède. */
export interface AccountRoles {
  /** Espace choisi à l'inscription. */
  primary: AccountType;
  customer: boolean;
  driver: boolean;
}

export type DriverRequirement = 'photo' | 'driver_license' | 'vehicle' | 'vehicle_registration';

/** Miroir de GET /driver-profiles/me/compliance : où en est le dossier du conducteur. */
export interface DriverCompliance {
  status: 'PENDING' | 'IN_VERIFICATION' | 'VALIDATED' | 'SUSPENDED' | 'BLOCKED' | 'DEACTIVATED';
  isCompliant: boolean;
  missing: DriverRequirement[];
  missingLabels: string[];
  /** Dossier complet : il n'attend plus que l'examen de l'équipe. */
  awaitingReview: boolean;
  graceDays: number;
  deadlineAt: string;
  daysLeft: number;
  graceExpired: boolean;
  canCreateTrips: boolean;
  canCarryShipments: boolean;
  blockedReason: string | null;
}
