// web-admin/src/types/dashboards.types.ts
import type { Money } from '@/services/api/types';

export interface FinanceByCurrency {
  currencyId: string;
  isoCode: string;
  grossBookingRevenue: Money;
  bookingCommission: Money;
  grossShipmentRevenue: Money;
  shipmentCommission: Money;
  refundedAmount: Money;
  refundedCount: number;
}

export interface AdminDashboardOverview {
  users: { total: number; drivers: number; verifiedDrivers: number; customers: number };
  active: { drivers: number; customers: number; windowDays: number };
  trips: { total: number; bookings: number; completedBookings: number };
  shipments: { total: number; completed: number };
  disputes: { total: number; open: number; resolutionRatePercent: number | null };
  /** Jamais une seule valeur — une devise par élément, jamais additionnées entre elles. */
  finance: FinanceByCurrency[];
}

export interface TopRoute {
  originName: string;
  destinationName: string;
  bookingCount: number;
}

export type CommissionSummaryPeriod = 'week' | 'month' | 'quarter' | 'year';

export interface CommissionFiguresByCurrency {
  currencyId: string;
  isoCode: string;
  bookingCommission: Money;
  shipmentCommission: Money;
  totalCommission: Money;
}

export interface CommissionFigures {
  from: string;
  to: string;
  byCurrency: CommissionFiguresByCurrency[];
}

export interface CommissionSummary {
  period: CommissionSummaryPeriod;
  current: CommissionFigures;
  previous: CommissionFigures;
}

/** Granularité acceptée par GET /dashboards/admin/revenue-time-series et /activity-time-series (voir RevenueTimeSeriesDto côté backend). */
export type RevenueGranularity = 'day' | 'week' | 'month' | 'year';

export interface RevenueTimeSeriesPoint {
  /** Date ISO du début du groupe (ex. début de journée/semaine/mois selon la granularité). */
  period: string;
  commission: Money;
}

export interface ActivityTimeSeriesPoint {
  /** Date ISO du début du groupe. */
  period: string;
  tripsCount: number;
  shipmentsCount: number;
}