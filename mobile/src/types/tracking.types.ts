// mobile/src/types/tracking.types.ts
// [10/10/2026] v1 — suivi d'un colis (réponse de GET /tracking/public/:numéro et /tracking/shipments/:id).

export type TrackingOutcome = 'ACTIVE' | 'DELIVERED' | 'CANCELLED' | 'INCIDENT';

export interface TrackingProgressStep {
  key: string;
  label: string;
  state: 'DONE' | 'CURRENT' | 'TODO';
}

export interface TrackingJourneyPoint {
  cityName: string;
  kind: 'PICKUP' | 'STOP' | 'DELIVERY';
  state: 'DONE' | 'NEXT' | 'TODO';
  /** Quand le colis y est passé — null si pas encore, ou si le signal n'a pas été donné. */
  at: string | null;
}

export interface TrackingLocation {
  /** Phrase prête à afficher : « Entre Kindia et Mamou ». */
  label: string;
  /** GPS : suivi en direct ; CITIES : déduit des villes traversées ; NONE : pas encore en route. */
  source: 'GPS' | 'CITIES' | 'NONE';
  latitude: number | null;
  longitude: number | null;
  updatedAt: string | null;
  /** Vrai dans la vue publique : coordonnées arrondies (~5 km). */
  isApproximate: boolean;
  /** Position GPS pas mise à jour depuis plus de 15 minutes. */
  isStale: boolean;
}

export interface TrackingEvent {
  status: string;
  label: string;
  at: string;
}

export interface ShipmentTracking {
  trackingNumber: string;
  trackingNumberFormatted: string;
  status: string;
  outcome: TrackingOutcome;
  headline: string;
  pickupCity: string;
  deliveryCity: string;
  parcelsCount: number;
  driverFirstName: string | null;
  progress: TrackingProgressStep[];
  journey: TrackingJourneyPoint[];
  location: TrackingLocation;
  /** Du plus récent au plus ancien. */
  events: TrackingEvent[];
  updatedAt: string;
}
