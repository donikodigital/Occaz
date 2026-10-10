// mobile/src/types/shipments.types.ts
// [10/10/2026] v5 — recipientEmail (facultatif) : le destinataire reçoit le suivi par e-mail.
// [09/10/2026] v4 — invitations de conducteurs : DriverSearchResult, ShipmentInvitationSummary, DriverInvitation.
// [23/09/2026] v3 — champ promoCode facultatif sur CreateShipmentPayload.
// [21/09/2026] v2 — plage de dates, conducteur direct, devis, AvailableShipment, tripId facultatif à l'acceptation.
import type { Money } from '@/services/api/types';
import type { TripLocation } from './trips.types';

export type ShipmentStatus =
  | 'CREATED'
  | 'SEARCHING_DRIVER'
  | 'DRIVER_ASSIGNED'
  | 'PICKUP_PENDING'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'DELIVERY_PENDING'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED'
  | 'REFUNDED';

export interface ShipmentCategory {
  id: string;
  name: string;
  description: string | null;
  isAllowed: boolean;
  countryId: string | null;
  maxDeclaredValue: Money | null;
  currencyId: string | null;
  priceMultiplier: number;
}

export interface ShipmentItem {
  id: string;
  shipmentId: string;
  label: string;
  weightKg: number | null;
  photoUrl: string | null;
  /** Détail d'un colis d'un envoi multiple — nul pour les envois créés avant la saisie colis par colis. */
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  declaredValue?: Money | null;
  description?: string | null;
  /** Prix de ce colis (hors majoration d'urgence). */
  price?: Money | null;
}

/** Un colis tel que saisi : mesures de CE colis, valeur déclarée et description facultatives. */
export interface ParcelInput {
  weightKg: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  declaredValue?: string;
  description?: string;
}

export interface ShipmentTrackingEntry {
  id: string;
  shipmentId: string;
  status: ShipmentStatus;
  latitude: number | null;
  longitude: number | null;
  note: string | null;
  recordedAt: string;
}

/** Conducteur tel que l'API l'expose aux parties d'un envoi : jamais ses coordonnées de paiement. */
export interface ShipmentDriverSummary {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  averageRating: number | null;
  ratingsCount: number;
}

export interface ShipmentTripSummary {
  id: string;
  departureAt: string;
  driver: ShipmentDriverSummary;
}

export interface ShipmentCurrency {
  id: string;
  isoCode: string;
  symbol: string | null;
}

export interface Shipment {
  id: string;
  /** Trajet auquel l'envoi est rattaché — nul si le conducteur n'a pas de trajet établi. */
  tripId: string | null;
  trip?: ShipmentTripSummary | null;
  /** Conducteur qui a accepté l'envoi (avec ou sans trajet). */
  driverId: string | null;
  driver?: ShipmentDriverSummary | null;
  /** Révélé par le serveur uniquement une fois un conducteur assigné — null avant, jamais calculé côté client. */
  driverPhone: string | null;
  customerId: string;
  categoryId: string;
  category?: ShipmentCategory;
  senderName: string;
  /** null côté conducteur une fois le colis livré sans litige : le serveur ne communique plus les numéros. */
  senderPhone: string | null;
  senderLocationId: string;
  senderLocation?: TripLocation;
  recipientName: string;
  /** null côté conducteur une fois le colis livré sans litige. */
  recipientPhone: string | null;
  /** Facultatif ; jamais communiqué au conducteur. */
  recipientEmail?: string | null;
  recipientLocationId: string;
  recipientLocation?: TripLocation;
  description: string | null;
  weightKg: number;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  quantity: number;
  declaredValue: Money | null;
  instructions: string | null;
  isUrgent: boolean;
  /** Plage de dates souhaitée par le client. */
  windowStart: string;
  windowEnd: string;
  /** Renseigné quand la plage est terminée sans conducteur : le client doit prolonger ou être remboursé. */
  extensionRequestedAt: string | null;
  status: ShipmentStatus;
  /** Le client paie un seul montant : `totalAmount` (= `price`). `platformFee` est la commission prélevée sur le gain du conducteur. */
  price: Money;
  platformFee: Money;
  totalAmount: Money;
  currencyId: string;
  currency?: ShipmentCurrency;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  items?: ShipmentItem[];
  tracking?: ShipmentTrackingEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateShipmentPayload {
  tripId?: string;
  categoryId: string;
  /** Facultatifs et ignorés par le serveur : l'expéditeur est le titulaire du compte (nom du profil, téléphone du compte). */
  senderName?: string;
  senderPhone?: string;
  senderLocationId: string;
  recipientName: string;
  recipientPhone: string;
  recipientEmail?: string;
  recipientLocationId: string;
  description?: string;
  weightKg: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  quantity?: number;
  declaredValue?: string;
  /** Les colis, un par un : le serveur en tire quantité, poids total et valeur déclarée, et calcule le prix de chacun. */
  parcels?: ParcelInput[];
  instructions?: string;
  isUrgent?: boolean;
  /** Plage de dates du départ (ISO) — obligatoire. */
  windowStart: string;
  windowEnd: string;
  /** Code promo à appliquer, s'il y en a un — voir /promo-codes/validate pour l'aperçu avant envoi. */
  promoCode?: string;
}

/** Ce qui entre dans le calcul du prix — sert au devis affiché avant paiement. */
export interface QuoteShipmentPayload {
  categoryId: string;
  senderLocationId: string;
  recipientLocationId: string;
  weightKg: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  quantity?: number;
  declaredValue?: string;
  parcels?: ParcelInput[];
  isUrgent?: boolean;
}

/** Prix d'un colis dans le devis (même ordre que la saisie). */
export interface ShipmentParcelQuote {
  index: number;
  weightKg: number | null;
  price: Money;
  chargeableWeightKg: number;
  volumetricWeightKg: number | null;
}

export interface ShipmentQuote {
  totalAmount: Money;
  quantity?: number;
  weightKg?: number;
  /** Prix de chaque colis — vide pour un devis global. */
  parcels?: ShipmentParcelQuote[];
  /** Majoration d'urgence, comptée une seule fois pour tout l'envoi. */
  urgentSurcharge?: Money;
  currencyId: string;
  currencyCode: string | null;
  distanceKm: number;
  chargeableWeightKg: number;
  volumetricWeightKg: number | null;
}

export interface ExtendShipmentPayload {
  windowEnd: string;
}

/**
 * Demande d'envoi telle que la voit un conducteur AVANT d'avoir accepté :
 * sans nom, téléphone ni consigne du client, adresses réduites à leur
 * ville (voir backend/src/shipments/shipment-views.ts).
 */
export interface AvailableShipment {
  id: string;
  status: ShipmentStatus;
  categoryId: string;
  category: { id: string; name: string };
  senderLocation: Pick<TripLocation, 'id' | 'label' | 'cityId'>;
  recipientLocation: Pick<TripLocation, 'id' | 'label' | 'cityId'>;
  weightKg: number;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  quantity: number;
  declaredValue: Money | null;
  description: string | null;
  isUrgent: boolean;
  windowStart: string;
  windowEnd: string;
  price: Money;
  platformFee: Money;
  totalAmount: Money;
  currencyId: string;
  currencyCode: string;
  createdAt: string;
}

export interface CancelShipmentPayload {
  reason: string;
}

export interface SearchAvailableShipmentsParams {
  originCityId?: string;
  destinationCityId?: string;
  /** Un de mes trajets : ne garde que les colis dont le ramassage précède la livraison sur sa route (villes traversées comprises). */
  tripId?: string;
  page?: number;
  limit?: number;
}

export interface AssignShipmentPayload {
  /** Facultatif : un conducteur validé sans trajet établi peut accepter un envoi. */
  tripId?: string;
}

// --- Invitations : le client cherche un conducteur et l'invite à prendre son colis ---

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';

export interface SearchDriversParams {
  /** Ville où le colis doit arriver — obligatoire. */
  destinationCityId: string;
  /** Facultative : sans elle, tout conducteur qui se rend à la ville d'arrivée est proposé. */
  originCityId?: string;
}

/** Un conducteur trouvé (un trajet par conducteur) — champs publics seulement. */
export interface DriverSearchResult {
  tripId: string;
  departureAt: string;
  /** Heure à laquelle le conducteur passe au point de départ cherché. */
  passingAt: string;
  originCityName: string;
  destinationCityName: string;
  viaCityNames: string[];
  driver: {
    firstName: string;
    lastName: string;
    photoUrl: string | null;
    averageRating: number | null;
    ratingsCount: number;
    isVerifiedBadge: boolean;
    completedTripsCount: number;
  };
  vehicle: { brand: string; model: string; color: string | null } | null;
  /** Déjà invité pour cet envoi ? null = pas encore. */
  invitationStatus: InvitationStatus | null;
}

export interface InviteDriversResult {
  invited: number;
  alreadyInvited: number;
  unavailable: number;
}

/** Invitation envoyée, vue par le client. */
export interface ShipmentInvitationSummary {
  id: string;
  status: InvitationStatus;
  createdAt: string;
  driver: { firstName: string; lastName: string; photoUrl: string | null };
}

/** Invitation reçue, vue par le conducteur : le message du client et l'envoi (sans donnée personnelle). */
export interface DriverInvitation {
  id: string;
  createdAt: string;
  message: string;
  shipment: AvailableShipment;
  trip: { id: string; departureAt: string; originCityName: string; destinationCityName: string } | null;
}
