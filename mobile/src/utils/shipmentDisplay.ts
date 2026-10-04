// mobile/src/utils/shipmentDisplay.ts
// [21/09/2026] v1 — gain net, période, trajets éligibles (plage de dates incluse).
import type { AvailableShipment, Shipment } from '@/types/shipments.types';
import type { Trip, TripLocation } from '@/types/trips.types';
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

/**
 * "Marché Medina — Dakar, Sénégal" : ville et pays seulement là où le
 * serveur les a inclus (détail d'un envoi, GET /shipments/:id) — se
 * réduit au seul libellé sinon, pour ne rien casser là où cette donnée
 * n'est pas (encore) renvoyée.
 */
export function formatLocation(location: Pick<TripLocation, 'label' | 'city'> | null | undefined): string {
  if (!location) return '—';
  const city = location.city;
  if (!city) return location.label;
  const place = [city.name, city.country?.name].filter(Boolean).join(', ');
  return place ? `${location.label} — ${place}` : location.label;
}

/**
 * "Dakar, Sénégal" — affichage compact pour une ligne de liste (sans le
 * libellé de rue, trop long pour une ligne). null si le serveur n'a pas
 * inclus la ville : à l'appelant de choisir son repli.
 */
export function formatCityCountry(location: Pick<TripLocation, 'city'> | null | undefined): string | null {
  const city = location?.city;
  if (!city) return null;
  const parts = [city.name, city.country?.name].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

/**
 * « Dakar → Koundara » : ville de ramassage puis ville de livraison d'un envoi. À défaut de ville (adresse non rattachée),
 * le libellé de l'adresse ; null si l'une des deux extrémités est inconnue (l'appelant choisit son repli).
 */
export function formatShipmentRoute(shipment: {
  senderLocation?: Pick<TripLocation, 'city' | 'label'> | null;
  recipientLocation?: Pick<TripLocation, 'city' | 'label'> | null;
}): string | null {
  const from = shipment.senderLocation?.city?.name ?? shipment.senderLocation?.label;
  const to = shipment.recipientLocation?.city?.name ?? shipment.recipientLocation?.label;
  return from && to ? `${from} → ${to}` : null;
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

/**
 * Heure à laquelle le trajet passe à la ville de ramassage de l'envoi, si sa route (départ, villes traversées, arrivée) va
 * de cette ville à la ville de livraison dans cet ordre ; null sinon. Un colis Kindia → Labé convient donc à un trajet
 * Conakry → Labé qui traverse Kindia. Même règle que le serveur (ShipmentsService.accept).
 */
export function shipmentPassingAt(trip: Trip, shipment: WithCities): Date | null {
  const from = shipment.senderLocation?.cityId;
  const to = shipment.recipientLocation?.cityId;
  if (!from || !to) return null;

  const stops = [...(trip.stops ?? [])].sort((a, b) => a.sequence - b.sequence);
  const route: Array<{ cityId: string | null | undefined; at: string | null }> = [
    { cityId: trip.originCityId, at: trip.departureAt },
    ...stops.map((stop) => ({ cityId: stop.cityId, at: stop.estimatedArrivalAt })),
    { cityId: trip.destinationCityId, at: null },
  ];
  for (let i = 0; i < route.length; i += 1) {
    if (route[i].cityId !== from) continue;
    if (route.slice(i + 1).some((point) => point.cityId === to)) return new Date(route[i].at ?? trip.departureAt);
  }
  return null;
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
  const hasCities = Boolean(shipment.senderLocation?.cityId && shipment.recipientLocation?.cityId);

  /** Le trajet passe par les deux villes dans le bon ordre ET son passage au ramassage tombe dans la plage du client. */
  function fitsWindowAndRoute(trip: Trip): boolean {
    if (!hasCities) return isWithinWindow(trip, shipment);
    const passingAt = shipmentPassingAt(trip, shipment);
    if (!passingAt) return false;
    const time = passingAt.getTime();
    return time >= new Date(shipment.windowStart).getTime() && time <= new Date(shipment.windowEnd).getTime();
  }

  return trips
    .filter(
      (trip) =>
        trip.status === 'PUBLISHED' &&
        trip.allowsShipments &&
        fitsWindowAndRoute(trip) &&
        (trip.availableShipmentWeightKg === null || trip.availableShipmentWeightKg >= shipment.weightKg),
    )
    .sort((a, b) => {
      const matchDelta = Number(isSameRoute(b, shipment)) - Number(isSameRoute(a, shipment));
      if (matchDelta !== 0) return matchDelta;
      return new Date(a.departureAt).getTime() - new Date(b.departureAt).getTime();
    });
}