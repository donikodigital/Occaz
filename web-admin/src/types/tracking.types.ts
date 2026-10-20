// web-admin/src/types/tracking.types.ts
// [20/10/2026] v1 — Suivi public d'un colis : miroir de TrackingView (backend/src/tracking/tracking.service.ts), dates en texte ISO.

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
  at: string | null;
}

export interface TrackingLocation {
  label: string;
  /** GPS : suivi en direct ; CITIES : déduit des villes traversées ; NONE : pas encore en route. */
  source: 'GPS' | 'CITIES' | 'NONE';
  latitude: number | null;
  longitude: number | null;
  updatedAt: string | null;
  /** Coordonnées arrondies (~5 km) sur la vue publique. */
  isApproximate: boolean;
  isStale: boolean;
}

export interface TrackingEvent {
  status: string;
  label: string;
  at: string;
}

export interface TrackingView {
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
  events: TrackingEvent[];
  updatedAt: string;
}
