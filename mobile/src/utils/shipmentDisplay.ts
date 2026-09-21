// mobile/src/utils/shipmentDisplay.ts
// [21/09/2026] v1 — gain net, période, trajets éligibles (plage de dates incluse).
import type { AvailableShipment, Shipment } from '@/types/shipments.types';
import type { Trip } from '@/types/trips.types';
import { formatDateShort } from '@/utils/date';

/**
 * Montant réellement crédité au chauffeur à la livraison : le client paie
 * un seul montant (`totalAmount`) et la commission de la plateforme
 * (`platformFee`, règle configurée dans l'admin) en est déduite — ex. 150 000
 * payés, 10 % de commission, 135 000 crédités. Même formule que le backend
 * (WalletsService.holdShipmentRevenue) ; si la règle change côté backend,
 * ce helper est le seul endroit à adapter côté mobile.
 */
export function driverNetAmount(shipment: Pick<Shipment, 'totalAmount' | 'platformFee'>): string {
  try {
    const zero = BigInt(0);
    const net = BigInt(shipment.totalAmount) - BigInt(shipment.platformFee);
    return (net > zero ? net : zero).toString();
  } catch {
    return shipment.totalAmount;
  }
}

/** "À l'instant", "Il y a 12 min", "Il y a 3 h", "Il y a 2 j". */
export function timeAgo(isoDate: string, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - new Date(isoDate).getTime()) / 60_000));
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  return `Il y a ${Math.round(hours / 24)} j`;
}

/** "40 × 30 × 20 cm" — null si une des trois dimensions manque. */
export function formatDimensions(shipment: Pick<Shipment, 'lengthCm' | 'widthCm' | 'heightCm'>): string | null {
  const { lengthCm, widthCm, heightCm } = shipment;
  if (lengthCm == null || widthCm == null || heightCm == null) return null;
  return `${lengthCm} × ${widthCm} × ${heightCm} cm`;
}

/** "Du 25 sept. au 27 sept." — ou "Le 25 sept." quand début et fin tombent le même jour. */
export function formatWindow(shipment: Pick<Shipment, 'windowStart' | 'windowEnd'>): string {
  const start = formatDateShort(shipment.windowStart);
  const end = formatDateShort(shipment.windowEnd);
  return start === end ? `Le ${start}` : `Du ${start} au ${end}`;
}

type WithCities = {
  senderLocation?: { cityId: string | null };
  recipientLocation?: { cityId: string | null };
};

/** Le trajet du chauffeur relie exactement les deux villes de l'envoi (départ et arrivée). */
export function isSameRoute(trip: Pick<Trip, 'originCityId' | 'destinationCityId'>, shipment: WithCities): boolean {
  const from = shipment.senderLocation?.cityId;
  const to = shipment.recipientLocation?.cityId;
  return Boolean(from && to && trip.originCityId === from && trip.destinationCityId === to);
}

/** Le départ du trajet tombe dans la plage de dates choisie par le client. */
export function isWithinWindow(trip: Pick<Trip, 'departureAt'>, shipment: Pick<Shipment, 'windowStart' | 'windowEnd'>): boolean {
  const departure = new Date(trip.departureAt).getTime();
  return departure >= new Date(shipment.windowStart).getTime() && departure <= new Date(shipment.windowEnd).getTime();
}

/**
 * Trajets du chauffeur sur lesquels l'envoi peut être rattaché : publiés,
 * ouverts aux colis, départ dans la plage du client, assez de capacité
 * restante (mêmes conditions que ShipmentsService.accept). Ceux qui relient
 * exactement les deux villes passent en premier, puis par date de départ.
 * Un chauffeur sans trajet compatible peut quand même accepter, sans trajet.
 */
export function getEligibleTrips(trips: Trip[], shipment: AvailableShipment): Trip[] {
  return trips
    .filter(
      (trip) =>
        trip.status === 'PUBLISHED' &&
        trip.allowsShipments &&
        isWithinWindow(trip, shipment) &&
        (trip.availableShipmentWeightKg === null || trip.availableShipmentWeightKg >= shipment.weightKg),
    )
    .sort((a, b) => {
      const matchDelta = Number(isSameRoute(b, shipment)) - Number(isSameRoute(a, shipment));
      if (matchDelta !== 0) return matchDelta;
      return new Date(a.departureAt).getTime() - new Date(b.departureAt).getTime();
    });
}