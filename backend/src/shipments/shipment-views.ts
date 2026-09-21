// backend/src/shipments/shipment-views.ts
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
 * Vue d'une demande d'envoi telle que la voit un chauffeur AVANT d'avoir
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