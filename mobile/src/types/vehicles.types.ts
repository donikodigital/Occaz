// mobile/src/types/vehicles.types.ts
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

export interface CreateVehiclePayload {
  brand: string;
  model: string;
  year?: number;
  color?: string;
  plateNumber: string;
  type?: VehicleType;
  totalSeats: number;
}
