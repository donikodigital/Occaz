// mobile/src/types/profiles.types.ts
export interface CustomerProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  countryId: string | null;
  cityId: string | null;
  dateOfBirth: string | null;
}

export interface CreateCustomerProfilePayload {
  firstName: string;
  lastName: string;
  email?: string;
  countryId?: string;
  cityId?: string;
}

export type DriverAccountStatus = 'PENDING' | 'VALIDATED' | 'SUSPENDED' | 'REJECTED';

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
