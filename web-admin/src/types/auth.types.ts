// web-admin/src/types/auth.types.ts
// [02/10/2026] v+ — SafeUser.permissions : permissions effectives du compte connecté (renvoyées par GET /users/me uniquement).
export type AccountType = 'CUSTOMER' | 'DRIVER' | 'SUPPORT' | 'SUPERADMIN';

/** Miroir de UsersService.SafeUser côté backend — jamais de passwordHash/twoFactorSecret. */
export interface SafeUser {
  id: string;
  phone: string;
  email: string | null;
  accountType: AccountType;
  isPhoneVerified: boolean;
  isActive: boolean;
  isSuspended: boolean;
  suspendedReason: string | null;
  lastLoginAt: string | null;
  isTwoFactorEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  /** Dénormalisés depuis CustomerProfile/DriverProfile — null pour Support/SuperAdmin (pas de profil). */
  firstName: string | null;
  lastName: string | null;
  /**
   * Permissions effectives (rôles attribués). Présent uniquement sur le compte connecté, une fois
   * GET /users/me chargé — absent des listes d'utilisateurs et juste après la connexion.
   */
  permissions?: string[];
  /** Pays auxquels les rôles du compte sont limités (GET /users/me) ; vide ou absent = aucune limite géographique. */
  scopedCountries?: { id: string; name: string }[];
}

export interface LoginPasswordPayload {
  email: string;
  password: string;
  twoFactorCode?: string;
}

/** Connexion de l'équipe par code reçu par e-mail (jamais par SMS). */
export interface RequestStaffCodePayload {
  email: string;
}

export interface RequestStaffCodeResult {
  expiresInSeconds: number;
  /** Adresse masquée où le code a été envoyé (« a•••t@occaz.sarl »). */
  destination: string;
}

export interface VerifyStaffCodePayload {
  email: string;
  code: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResult extends AuthTokens {
  user: SafeUser;
}

export interface SetupTwoFactorResult {
  secret: string;
  otpAuthUri: string;
}