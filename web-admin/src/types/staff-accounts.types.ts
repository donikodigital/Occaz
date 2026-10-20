// web-admin/src/types/staff-accounts.types.ts
// Miroir de backend/src/staff-accounts/staff-accounts.service.ts (StaffAccountSummary, CreateStaffAccountResult).
export type StaffAccountStatus = 'ACTIVE' | 'INVITED' | 'INVITATION_EXPIRED';

export interface StaffAccountRole {
  key: string;
  name: string;
  /** Vrai si le rôle s'exerce dans tous les pays. */
  allCountries: boolean;
  countries: Array<{ id: string; name: string; isoCode: string }>;
}

export interface StaffAccount {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string;
  address: string | null;
  isSuspended: boolean;
  status: StaffAccountStatus;
  createdAt: string;
  roles: StaffAccountRole[];
}

export interface CreateStaffAccountPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: string;
  roleId: string;
  /** Vide ou absent : tous les pays. */
  countryIds?: string[];
}

export interface CreateStaffAccountResult {
  account: StaffAccount;
  /** Faux si l'e-mail de bienvenue n'a pas pu partir : le compte existe, l'invitation peut être renvoyée. */
  invitationSent: boolean;
}

export interface StaffInvitationPreview {
  firstName: string | null;
  email: string;
}
