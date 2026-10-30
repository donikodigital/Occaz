// mobile/src/types/auth.types.ts
// [30/10/2026] v+ — téléphones de confiance : état de confiance après connexion, connexion qui demande un code, secret du téléphone.
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
  /** Langue mémorisée sur le compte (le serveur écrit notifications, SMS et e-mails dans cette langue). */
  language?: 'fr' | 'en-GB' | 'pt-PT';
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
  /** Case « J'accepte les conditions d'utilisation et la politique de confidentialité » cochée (l'API refuse sans). */
  acceptedTerms: boolean;
  /** Version des textes affichés (LEGAL_VERSION). */
  termsVersion?: string;
}

export interface LoginPhonePayload {
  phone: string;
  /** Mot de passe à 6 chiffres. */
  password: string;
  /** Espace choisi à l'écran d'accueil : sert à expliquer l'erreur quand le compte est de l'autre type. */
  expectedAccountType?: 'CUSTOMER' | 'DRIVER';
  device?: DeviceInfo;
  /** Preuve que ce téléphone est un téléphone de confiance du compte (absente si aucun n'est enregistré ici). */
  trustedDevice?: TrustedDeviceCredential;
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

/** Secret de CE téléphone, remis à l'enregistrement comme téléphone de confiance. */
export interface TrustedDeviceCredential {
  id: string;
  secret: string;
}

/** Ce que l'API dit de ce téléphone après une connexion réussie. */
export interface DeviceTrustInfo {
  /** Le compte a au moins un téléphone de confiance. */
  hasTrustedDevice: boolean;
  /** CE téléphone en est un. */
  thisDeviceTrusted: boolean;
  /** Il faut demander « Enregistrer ce téléphone comme téléphone de confiance ? ». */
  offer: boolean;
}

/** Session ouverte + état de confiance du téléphone. */
export interface TrustedAuthResult extends AuthResult {
  trust: DeviceTrustInfo;
}

/** La connexion est arrêtée : ce téléphone n'est pas de confiance, un code vient d'être envoyé (e-mail en priorité, sinon SMS). */
export interface DeviceVerificationRequired {
  requiresDeviceVerification: true;
  challengeToken: string;
  channel: 'EMAIL' | 'SMS';
  /** Où le code est parti, masqué. */
  destination: string;
  /** Le compte a un e-mail vérifié : on peut proposer « Recevoir le code par SMS à la place ». */
  canUseSms: boolean;
  expiresInSeconds: number;
}

export type PhoneLoginResult = TrustedAuthResult | DeviceVerificationRequired;

export function needsDeviceVerification(result: { requiresDeviceVerification?: true } | object): result is DeviceVerificationRequired {
  return 'requiresDeviceVerification' in result && result.requiresDeviceVerification === true;
}

/** Connexion par empreinte : la session habituelle + le NOUVEAU secret à ranger dans le coffre du téléphone. */
export interface BiometricLoginResult extends TrustedAuthResult {
  biometricToken: string;
}
