// web-admin/src/types/drivers.types.ts
export type DriverAccountStatus = 'PENDING' | 'VALIDATED' | 'SUSPENDED' | 'REJECTED';
export type VehicleType = 'SEDAN' | 'SUV' | 'VAN' | 'MINIBUS' | 'PICKUP' | 'MOTORCYCLE';
export type DocumentStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface Vehicle {
  id: string;
  driverId: string;
  brand: string;
  model: string;
  year: number | null;
  color: string | null;
  plateNumber: string;
  type: VehicleType;
  totalSeats: number;
  photoUrl: string | null;
  verificationStatus: DocumentStatus;
}

export interface DriverProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  countryId: string;
  country?: { id: string; name: string };
  cityId: string;
  city?: { id: string; name: string };
  dateOfBirth: string | null;
  status: DriverAccountStatus;
  isVerifiedBadge: boolean;
  mobileMoneyNumber: string | null;
  cancellationCount: number;
  completedTripsCount: number;
  completedShipmentsCount: number;
  averageRating: number | null;
  ratingsCount: number;
  vehicles?: Vehicle[];
  createdAt: string;
}

export interface SuspendDriverPayload {
  reason: string;
}
