// backend/src/shipments/shipment-views.ts
// [10/10/2026] v2 — l'e-mail du destinataire n'est jamais communiqué au conducteur.
// [21/09/2026] v1 — vue des envois disponibles sans données personnelles (liste blanche).
import { Prisma } from '@prisma/client';

export type AvailableShipmentSource = Prisma.ShipmentGetPayload<{
  include: {
    category: true;
    currency: true;
    senderLocation: { include: { city: true } };
    recipientLocation: { include: { city: true } };
  };
}>;

/**
 * Vue d'une demande d'envoi telle que la voit un conducteur AVANT d'avoir
 * accepté. Liste blanche explicite : ni noms, ni téléphones, ni consignes
 * du client (elles ne sont communiquées qu'après l'acceptation, via
 * GET /shipments/:id), et les adresses sont réduites à leur ville — un
 * libellé saisi librement peut contenir une adresse personnelle. Écrite
 * champ par champ exprès : un champ ajouté plus tard au modèle Shipment ne
 * fuit jamais ici par accident.
 */
export function toAvailableShipmentView(shipment: AvailableShipmentSource) {
  return {
    id: shipment.id,
    status: shipment.status,
    categoryId: shipment.categoryId,
    category: { id: shipment.category.id, name: shipment.category.name },
    senderLocation: maskLocation(shipment.senderLocation),
    recipientLocation: maskLocation(shipment.recipientLocation),
    weightKg: shipment.weightKg,
    lengthCm: shipment.lengthCm,
    widthCm: shipment.widthCm,
    heightCm: shipment.heightCm,
    quantity: shipment.quantity,
    declaredValue: shipment.declaredValue,
    description: shipment.description,
    isUrgent: shipment.isUrgent,
    windowStart: shipment.windowStart,
    windowEnd: shipment.windowEnd,
    price: shipment.price,
    platformFee: shipment.platformFee,
    totalAmount: shipment.totalAmount,
    currencyId: shipment.currencyId,
    currencyCode: shipment.currency.isoCode,
    createdAt: shipment.createdAt,
  };
}

function maskLocation(location: AvailableShipmentSource['senderLocation']) {
  return {
    id: location.id,
    label: location.city?.name ?? 'Adresse précisée après acceptation',
    cityId: location.cityId,
  };
}
// ---------------------------------------------------------------------------
// Contacts une fois le colis livré
// ---------------------------------------------------------------------------

/** Statuts où la prestation est terminée sans litige : plus aucun appel ni SMS entre le conducteur et les clients. */
const CONTACT_CLOSED_STATUSES: ReadonlySet<string> = new Set(['DELIVERED', 'COMPLETED']);

export type ShipmentViewer = 'customer' | 'driver';

/**
 * Une fois le colis livré SANS litige (DELIVERED / COMPLETED), les numéros de téléphone ne sont plus communiqués :
 *  - au conducteur : ceux de l'expéditeur et du destinataire (il n'a plus de raison de les appeler) ;
 *  - au client : celui du conducteur.
 * Si un litige s'ouvre ensuite (statut DISPUTED), les numéros reviennent le temps de le régler. Le personnel du support
 * n'est jamais concerné (il garde tout) : cette fonction ne s'applique qu'aux vues client et conducteur.
 *
 * C'est la vraie protection : l'application ne fait que ne rien afficher quand le serveur ne renvoie rien.
 */
export function hideContactsOnceDelivered<
  T extends { status: string; senderPhone: string; recipientPhone: string; driverPhone?: string | null },
>(
  shipment: T,
  viewer: ShipmentViewer,
): Omit<T, 'senderPhone' | 'recipientPhone' | 'driverPhone'> & {
  senderPhone: string | null;
  recipientPhone: string | null;
  driverPhone?: string | null;
} {
  // L'e-mail du destinataire ne sert qu'au suivi par e-mail : le conducteur ne le reçoit jamais, livré ou non.
  const visible = viewer === 'driver' ? withoutRecipientEmail(shipment) : shipment;
  if (!CONTACT_CLOSED_STATUSES.has(shipment.status)) return visible;
  return viewer === 'driver'
    ? { ...visible, senderPhone: null, recipientPhone: null }
    : { ...visible, driverPhone: shipment.driverPhone === undefined ? undefined : null };
}

function withoutRecipientEmail<T extends object>(shipment: T): T {
  if (!('recipientEmail' in shipment)) return shipment;
  const { recipientEmail: _hidden, ...rest } = shipment as T & { recipientEmail?: unknown };
  return rest as T;
}
