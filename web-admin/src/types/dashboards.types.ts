// web-admin/src/types/dashboards.types.ts
import type { Money } from '@/services/api/types';

export interface AdminDashboardOverview {
  users: { total: number; drivers: number; verifiedDrivers: number; customers: number };
  active: { drivers: number; customers: number; windowDays: number };
  trips: { total: number; bookings: number; completedBookings: number };
  shipments: { total: number; completed: number };
  disputes: { total: number; open: number; resolutionRatePercent: number | null };
  finance: {
    grossBookingRevenue: Money;
    bookingCommission: Money;
    grossShipmentRevenue: Money;
    shipmentCommission: Money;
    refundedAmount: Money;
    refundedCount: number;
  };
}
