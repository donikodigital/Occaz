// web-admin/src/types/disputes.types.ts
export type DisputeStatus =
  | 'OPENED'
  | 'UNDER_REVIEW'
  | 'WAITING_FOR_CUSTOMER'
  | 'WAITING_FOR_DRIVER'
  | 'INVESTIGATION'
  | 'RESOLVED'
  | 'CLOSED';

export type DisputePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type DisputeResolutionType =
  | 'FULL_REFUND'
  | 'PARTIAL_REFUND'
  | 'DRIVER_PAYOUT'
  | 'SHARED_RESPONSIBILITY'
  | 'CANCELLATION'
  | 'SANCTION'
  | 'SUSPENSION'
  | 'NO_ACTION'
  | 'OTP_MANUAL_VALIDATION';

export type DisputeSubjectType = 'TRIP' | 'SHIPMENT';

/** Étape OTP concernée par une résolution OTP_MANUAL_VALIDATION. */
export type OtpPurpose = 'TRIP_PICKUP' | 'TRIP_DROPOFF' | 'SHIPMENT_PICKUP' | 'SHIPMENT_DELIVERY';

export interface DisputeMessage {
  id: string;
  disputeId: string;
  authorId: string;
  author?: { id: string; phone: string; email: string | null };
  message: string;
  createdAt: string;
}

export interface DisputeResolution {
  id: string;
  type: DisputeResolutionType;
  refundAmount: string | null;
  currencyId: string | null;
  otpPurpose: OtpPurpose | null;
  notes: string | null;
  createdAt: string;
}

export interface DisputeListItem {
  id: string;
  subjectType: DisputeSubjectType;
  bookingId: string | null;
  shipmentId: string | null;
  openedById: string;
  reason: string;
  description: string | null;
  status: DisputeStatus;
  priority: DisputePriority;
  assignedAgentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Dispute extends DisputeListItem {
  openedBy?: { id: string; phone: string; email: string | null };
  assignedAgent?: { id: string; phone: string; email: string | null } | null;
  messages?: DisputeMessage[];
  resolution?: DisputeResolution | null;
}

export interface AssignDisputePayload {
  agentUserId: string;
  priority?: DisputePriority;
}

export interface ResolveDisputePayload {
  type: DisputeResolutionType;
  refundAmount?: string;
  targetUserId?: string;
  otpPurpose?: OtpPurpose;
  notes?: string;
}