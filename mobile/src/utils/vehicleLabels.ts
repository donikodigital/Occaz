// mobile/src/utils/vehicleLabels.ts
import type { VehicleType } from '@/types/vehicles.types';

/**
 * Seule source de vérité pour les libellés de type de véhicule côté
 * mobile — utilisée par vehicle-new.tsx et VehicleDetailModal.tsx, pour
 * éviter que les deux dérivent l'un de l'autre (c'est exactement ce qui
 * s'était produit : VehicleType contenait "VAN", une valeur absente de
 * l'enum Prisma côté backend, ce qui faisait échouer silencieusement
 * toute sélection "Van").
 */
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

export const VEHICLE_TYPE_OPTIONS: { value: VehicleType; label: string }[] = (
  Object.entries(VEHICLE_TYPE_LABELS) as [VehicleType, string][]
).map(([value, label]) => ({ value, label }));