// mobile/src/types/auth.types.ts
export type AccountType = 'CUSTOMER' | 'DRIVER' | 'SUPPORT' | 'SUPERADMIN';

/** Miroir de UsersService.SafeUser côté backend (Lot 1) — jamais de passwordHash/twoFactorSecret. */
export interface SafeUser {
  id: string;
  phone: string;
  email: string | null;
  accountType: AccountType;
  isPhoneVerified: boolean;
  /** L'adresse e-mail n'est enregistrée sur le compte qu'une fois vérifiée par un code. */
  isEmailVerified: boolean;
  /** Client ou conducteur sans mot de passe : l'app l'envoie le définir avant de continuer. */
  mustSetPassword: boolean;
  firstName?: string | null;
  lastName?: string | null;
  isActive: boolean;
  isSuspended: boolean;
  suspendedReason: string | null;
  lastLoginAt: string | null;
  isTwoFactorEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceInfo {
  platform?: 'ios' | 'android' | 'web';
  pushToken?: string;
}

export interface RequestOtpPayload {
  phone: string;
  signupAccountType?: 'CUSTOMER' | 'DRIVER';
  /** LOGIN : le numéro doit déjà être inscrit. SIGNUP : un compte est créé si besoin. */
  intent?: 'LOGIN' | 'SIGNUP';
}

/** Inscription — étape du téléphone : un code SMS part tout de suite vers ce numéro. */
export interface SignupPhonePayload {
  phone: string;
  accountType: 'CUSTOMER' | 'DRIVER';
}

export interface LoginPhonePayload {
  phone: string;
  /** Mot de passe à 6 chiffres. */
  password: string;
  /** Espace choisi à l'écran d'accueil : sert à expliquer l'erreur quand le compte est de l'autre type. */
  expectedAccountType?: 'CUSTOMER' | 'DRIVER';
  device?: DeviceInfo;
}

export type PasswordResetChannel = 'SMS' | 'EMAIL';

export interface PasswordResetRequestResult {
  expiresInSeconds: number;
  /** Où le code est parti, masqué (« +224•••0010 », « f•••a@exemple.com »). */
  destination: string;
}

export interface VerifyOtpPayload {
  phone: string;
  code: string;
  device?: DeviceInfo;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResult extends AuthTokens {
  user: SafeUser;
}