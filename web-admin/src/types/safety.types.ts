// web-admin/src/types/safety.types.ts
// [11/10/2026] v1 — signalements d'utilisateurs et alertes SOS (miroir de backend/src/user-safety).
export type UserReportReason =
  | 'HARASSMENT'
  | 'UNSAFE_BEHAVIOR'
  | 'FRAUD'
  | 'NO_SHOW'
  | 'FAKE_PROFILE'
  | 'INAPPROPRIATE_CONTENT'
  | 'OTHER';

export type UserReportStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED';

export type SosStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'CANCELLED';

export interface ReportParty {
  id: string;
  name: string;
  phone: string;
}

export interface UserReportItem {
  id: string;
  reason: UserReportReason;
  reasonLabel: string;
  details: string | null;
  status: UserReportStatus;
  resolutionNote: string | null;
  tripId: string | null;
  bookingId: string | null;
  shipmentId: string | null;
  handledAt: string | null;
  createdAt: string;
  reporter: ReportParty;
  reportedUser: ReportParty & {
    accountType: 'CUSTOMER' | 'DRIVER' | 'SUPPORT' | 'SUPERADMIN';
    isSuspended: boolean;
    /** Nombre de signalements (hors rejetés) visant cette personne. */
    reportCount: number;
  };
}

/** Qui reçoit le message de rappel : la personne signalée ou celle qui a signalé. */
export type ReportReminderRecipient = 'REPORTED' | 'REPORTER';

export interface RemindReportPayload {
  recipient: ReportReminderRecipient;
  message: string;
}

export interface UpdateUserReportPayload {
  status: UserReportStatus;
  resolutionNote?: string;
}

export interface SosAlertItem {
  id: string;
  status: SosStatus;
  message: string | null;
  latitude: number | null;
  longitude: number | null;
  mapUrl: string | null;
  tripId: string | null;
  bookingId: string | null;
  shipmentId: string | null;
  contactsNotified: number;
  resolutionNote: string | null;
  handledAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: ReportParty & { emergencyContacts: { name: string; phone: string }[] };
}

export interface HandleSosPayload {
  status: 'ACKNOWLEDGED' | 'RESOLVED';
  resolutionNote?: string;
}
