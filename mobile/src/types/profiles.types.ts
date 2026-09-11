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
  countryId?: string;
  cityId?: string;
}
