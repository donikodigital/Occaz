// web-admin/src/utils/shipmentLabels.ts
// [21/09/2026] v1 — libellés, couleurs, regroupements et formats de date des envois.
import type { AdminShipmentListItem, ShipmentStatus } from '@/types/shipments.types';

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  CREATED: 'En attente de paiement',
  SEARCHING_DRIVER: 'Recherche de chauffeur',
  DRIVER_ASSIGNED: 'Chauffeur trouvé',
  PICKUP_PENDING: 'Récupération en cours',
  PICKED_UP: 'Colis récupéré',
  IN_TRANSIT: 'En transit',
  DELIVERY_PENDING: 'Livraison en cours',
  DELIVERED: 'Livré',
  COMPLETED: 'Terminé',
  CANCELLED: 'Annulé',
  DISPUTED: 'En litige',
  REFUNDED: 'Remboursé',
};

export type ShipmentTone = 'primary' | 'neutral' | 'success' | 'accent' | 'danger';

export const SHIPMENT_STATUS_TONE: Record<ShipmentStatus, ShipmentTone> = {
  CREATED: 'neutral',
  SEARCHING_DRIVER: 'accent',
  DRIVER_ASSIGNED: 'primary',
  PICKUP_PENDING: 'primary',
  PICKED_UP: 'primary',
  IN_TRANSIT: 'primary',
  DELIVERY_PENDING: 'primary',
  DELIVERED: 'success',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
  DISPUTED: 'danger',
  REFUNDED: 'neutral',
};

/** Regroupements pour filtrer la liste : ce que l'équipe veut vraiment voir d'un coup d'œil. */
export type ShipmentGroup = 'unpaid' | 'searching' | 'extension' | 'active' | 'done' | 'closed' | 'disputed';

export const SHIPMENT_GROUP_OPTIONS: { value: ShipmentGroup; label: string }[] = [
  { value: 'searching', label: 'En recherche' },
  { value: 'extension', label: 'Prolongation demandée' },
  { value: 'active', label: 'En cours' },
  { value: 'done', label: 'Terminés' },
  { value: 'unpaid', label: 'Non payés' },
  { value: 'disputed', label: 'En litige' },
  { value: 'closed', label: 'Annulés' },
];

export function groupOf(shipment: Pick<AdminShipmentListItem, 'status' | 'extensionRequestedAt'>): ShipmentGroup {
  switch (shipment.status) {
    case 'CREATED':
      return 'unpaid';
    case 'SEARCHING_DRIVER':
      return shipment.extensionRequestedAt ? 'extension' : 'searching';
    case 'DELIVERED':
    case 'COMPLETED':
      return 'done';
    case 'CANCELLED':
    case 'REFUNDED':
      return 'closed';
    case 'DISPUTED':
      return 'disputed';
    default:
      return 'active';
  }
}

/** Gain net du chauffeur : le client paie un seul montant, la commission en est déduite (ex. 150 000 − 10 % = 135 000). */
export function driverNet(totalAmount: string, platformFee: string): string {
  try {
    const net = BigInt(totalAmount) - BigInt(platformFee);
    return (net > BigInt(0) ? net : BigInt(0)).toString();
  } catch {
    return totalAmount;
  }
}

const SHORT_DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const DATE_TIME = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

export function formatShortDate(iso: string): string {
  return SHORT_DATE.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return DATE_TIME.format(new Date(iso));
}

/** « Du 25 sept. au 27 sept. » — ou « Le 25 sept. » quand début et fin tombent le même jour. */
export function formatWindow(windowStart: string, windowEnd: string): string {
  const start = formatShortDate(windowStart);
  const end = formatShortDate(windowEnd);
  return start === end ? `Le ${start}` : `Du ${start} au ${end}`;
}

/** « Conakry → Labé » — la ville quand elle est connue, sinon le libellé de l'adresse. */
export function routeLabel(shipment: Pick<AdminShipmentListItem, 'senderLocation' | 'recipientLocation'>): string {
  const from = shipment.senderLocation?.city?.name ?? shipment.senderLocation?.label ?? '—';
  const to = shipment.recipientLocation?.city?.name ?? shipment.recipientLocation?.label ?? '—';
  return `${from} → ${to}`;
}