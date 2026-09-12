// web-admin/src/types/auth.types.ts
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
}

export interface LoginPasswordPayload {
  email: string;
  password: string;
  twoFactorCode?: string;
}

export interface RequestOtpPayload {
  phone: string;
}

export interface VerifyOtpPayload {
  phone: string;
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
