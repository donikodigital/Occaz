// mobile/src/types/profiles.types.ts
//
// v3 — CreateCustomerProfilePayload : ajoute dateOfBirth et photoUrl
// (déjà acceptés par le backend via CreateCustomerProfileDto, jamais
// exposés côté type frontend jusqu'ici).

import type { City, Country } from '@/types/geography.types';

export interface CustomerProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  countryId: string | null;
  country: Country | null;
  cityId: string | null;
  city: City | null;
  dateOfBirth: string | null;
  address: string | null;
  createdAt: string;
}

export interface CreateCustomerProfilePayload {
  firstName: string;
  lastName: string;
  email?: string;
  photoUrl?: string;
  countryId?: string;
  cityId?: string;
  dateOfBirth?: string;
  address?: string;
}

export type DriverAccountStatus =
  | 'PENDING'
  | 'IN_VERIFICATION'
  | 'VALIDATED'
  | 'SUSPENDED'
  | 'BLOCKED'
  | 'DEACTIVATED';

export interface DriverProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  countryId: string;
  cityId: string;
  dateOfBirth: string | null;
  status: DriverAccountStatus;
  isVerifiedBadge: boolean;
  mobileMoneyNumber: string | null;
  cancellationCount: number;
  completedTripsCount: number;
  completedShipmentsCount: number;
  averageRating: number | null;
  ratingsCount: number;
}

export interface CreateDriverProfilePayload {
  firstName: string;
  lastName: string;
  email?: string;
  countryId: string;
  cityId: string;
  dateOfBirth?: string;
  mobileMoneyNumber?: string;
}