// web-admin/src/utils/driverLabels.ts
import type { DriverAccountStatus, VehicleType } from '@/types/drivers.types';

export const DRIVER_STATUS_LABELS: Record<DriverAccountStatus, string> = {
  PENDING: 'En attente de vérification',
  VALIDATED: 'Validé',
  SUSPENDED: 'Suspendu',
  REJECTED: 'Rejeté',
};

export const DRIVER_STATUS_TONE: Record<DriverAccountStatus, 'primary' | 'success' | 'accent' | 'danger' | 'neutral'> = {
  PENDING: 'accent',
  VALIDATED: 'success',
  SUSPENDED: 'danger',
  REJECTED: 'danger',
};

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  SEDAN: 'Berline',
  SUV: 'SUV',
  VAN: 'Van',
  MINIBUS: 'Minibus',
  PICKUP: 'Pick-up',
  MOTORCYCLE: 'Moto',
};
