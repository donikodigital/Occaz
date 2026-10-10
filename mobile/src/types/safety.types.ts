// mobile/src/types/safety.types.ts
// [11/10/2026] v1 — SOS, proches à prévenir, signalement et blocage d'utilisateurs, contrôle d'un billet (miroir de backend/src/user-safety).
export type UserReportReason =
  | 'HARASSMENT'
  | 'UNSAFE_BEHAVIOR'
  | 'FRAUD'
  | 'NO_SHOW'
  | 'FAKE_PROFILE'
  | 'INAPPROPRIATE_CONTENT'
  | 'OTHER';

/** Désigne la personne visée : UNE seule référence (profil conducteur, profil client ou compte). */
export interface UserTarget {
  userId?: string;
  driverId?: string;
  customerId?: string;
}

export interface CreateReportPayload extends UserTarget {
  reason: UserReportReason;
  details?: string;
  tripId?: string;
  bookingId?: string;
  shipmentId?: string;
  alsoBlock?: boolean;
}

export interface ReportResult {
  id: string;
  alreadyReported: boolean;
  blocked: boolean;
}

export interface BlockedUser {
  id: string;
  userId: string;
  name: string;
  accountType: 'CUSTOMER' | 'DRIVER' | 'SUPPORT' | 'SUPERADMIN';
  createdAt: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
}

export interface CreateEmergencyContactPayload {
  name: string;
  phone: string;
}

export type SosStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'CANCELLED';

export interface SosAlert {
  id: string;
  status: SosStatus;
  contactsNotified: number;
  contactsTotal: number;
  hasLocation: boolean;
  createdAt: string;
  /** true si l'appui a seulement rafraîchi une alerte déjà en cours (aucun nouveau SMS). */
  alreadyActive: boolean;
}

export interface TriggerSosPayload {
  tripId?: string;
  bookingId?: string;
  shipmentId?: string;
  latitude?: number;
  longitude?: number;
  message?: string;
}

export type ScanReason = 'INVALID' | 'OTHER_DRIVER' | 'NOT_ACTIVE';

export interface ScanBookingInfo {
  bookingId: string;
  tripId: string;
  reference: string;
  status: string;
  passengers: string[];
  seatsCount: number;
  boardedCount: number;
  from: string;
  to: string;
  departureAt: string;
}

export interface ScanParcelInfo {
  shipmentId: string;
  trackingNumber: string;
  parcelNumber: number;
  parcelCount: number;
  status: string;
  category: string;
  weightKg: number;
  from: string;
  to: string;
  recipientName: string;
}

export interface TicketScanResult {
  valid: boolean;
  kind?: 'BOOKING' | 'PARCEL';
  reason?: ScanReason;
  message: string;
  booking?: ScanBookingInfo;
  parcel?: ScanParcelInfo;
}
