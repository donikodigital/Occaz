// web-admin/src/utils/driverLabels.ts
import type { DriverAccountStatus, VehicleType } from '@/types/drivers.types';

export const DRIVER_STATUS_LABELS: Record<DriverAccountStatus, string> = {
  PENDING: 'En attente de vérification',
  IN_VERIFICATION: 'Vérification en cours',
  VALIDATED: 'Validé',
  SUSPENDED: 'Suspendu',
  BLOCKED: 'Bloqué',
  DEACTIVATED: 'Désactivé',
};

export const DRIVER_STATUS_TONE: Record<DriverAccountStatus, 'primary' | 'success' | 'accent' | 'danger' | 'neutral'> = {
  PENDING: 'accent',
  IN_VERIFICATION: 'accent',
  VALIDATED: 'success',
  SUSPENDED: 'danger',
  BLOCKED: 'danger',
  DEACTIVATED: 'neutral',
};

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  SEDAN: 'Berline',
  SUV: 'SUV',
  MINIVAN: 'Monospace',
  MINIBUS: 'Minibus',
  PICKUP: 'Pick-up',
  MOTORCYCLE: 'Moto',
  TRUCK: 'Camion',
  OTHER: 'Autre',
};