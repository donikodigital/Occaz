// mobile/src/types/vehicles.types.ts
export type VehicleType = 'SEDAN' | 'SUV' | 'MINIVAN' | 'MINIBUS' | 'PICKUP' | 'MOTORCYCLE' | 'TRUCK' | 'OTHER';
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

/** Mêmes champs que CreateVehiclePayload sauf plateNumber — non modifiable en libre-service côté backend (risque de fraude, voir UpdateVehicleDto). */
export type UpdateVehiclePayload = Partial<Omit<CreateVehiclePayload, 'plateNumber'>>;