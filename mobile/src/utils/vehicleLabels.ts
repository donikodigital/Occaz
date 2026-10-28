// mobile/src/utils/vehicleLabels.ts
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
import type { VehicleType } from '@/types/vehicles.types';
import { translate } from '@/i18n';

/**
 * Seule source de vérité pour les libellés de type de véhicule côté
 * mobile — utilisée par vehicle-new.tsx et VehicleDetailModal.tsx, pour
 * éviter que les deux dérivent l'un de l'autre (c'est exactement ce qui
 * s'était produit : VehicleType contenait "VAN", une valeur absente de
 * l'enum Prisma côté backend, ce qui faisait échouer silencieusement
 * toute sélection "Van").
 */
export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  get SEDAN() { return translate('Berline'); },
  SUV: 'SUV',
  get MINIVAN() { return translate('Monospace'); },
  get MINIBUS() { return translate('Minibus'); },
  get PICKUP() { return translate('Pick-up'); },
  get MOTORCYCLE() { return translate('Moto'); },
  get TRUCK() { return translate('Camion'); },
  get OTHER() { return translate('Autre'); },
};

// `label` est lu à l'affichage (getter) : la liste est construite une seule fois, avant le choix de la langue.
export const VEHICLE_TYPE_OPTIONS: { value: VehicleType; label: string }[] = (
  Object.keys(VEHICLE_TYPE_LABELS) as VehicleType[]
).map((value) => ({
  value,
  get label() {
    return VEHICLE_TYPE_LABELS[value];
  },
}));