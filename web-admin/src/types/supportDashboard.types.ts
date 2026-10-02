// web-admin/src/types/supportDashboard.types.ts
// Miroir de GET /dashboards/support (SupportDashboardService.getOverview côté backend).
import type { DisputePriority, DisputeStatus, DisputeSubjectType } from '@/types/disputes.types';

export interface SupportDisputeSummary {
  id: string;
  subjectType: DisputeSubjectType;
  reason: string;
  status: DisputeStatus;
  priority: DisputePriority;
  createdAt: string;
  /** Présent uniquement sur les nouveaux litiges. */
  openedBy?: { id: string; phone: string; email: string | null };
}

export interface FlaggedDriver {
  driverId: string;
  firstName: string;
  lastName: string;
  disputeCount: number;
}

export interface FlaggedCustomer {
  customerId: string;
  firstName: string;
  lastName: string;
  disputeCount: number;
}

export interface SupportDashboardOverview {
  newDisputes: SupportDisputeSummary[];
  urgentDisputes: SupportDisputeSummary[];
  pendingDisputesCount: number;
  flaggedDrivers: FlaggedDriver[];
  flaggedCustomers: FlaggedCustomer[];
}