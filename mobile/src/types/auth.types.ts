// mobile/src/types/auth.types.ts
export type AccountType = 'CUSTOMER' | 'DRIVER' | 'SUPPORT' | 'SUPERADMIN';

/** Miroir de UsersService.SafeUser côté backend (Lot 1) — jamais de passwordHash/twoFactorSecret. */
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

export interface DeviceInfo {
  platform?: 'ios' | 'android' | 'web';
  pushToken?: string;
}

export interface RequestOtpPayload {
  phone: string;
  signupAccountType?: 'CUSTOMER' | 'DRIVER';
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
