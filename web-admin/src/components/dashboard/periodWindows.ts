// web-admin/src/components/dashboard/periodWindows.ts
import type { CommissionSummaryPeriod, RevenueGranularity } from '@/types/dashboards.types';

export interface PeriodWindow {
  granularity: RevenueGranularity;
  from: string;
  to: string;
}

/**
 * Fenêtre de dates + granularité de regroupement pour le graphique, par
 * période sélectionnée. Le découpage (semaine calée sur lundi, mois,
 * trimestre, année) reflète celui du backend (commission-summary.service.ts)
 * pour que le graphique corresponde visuellement au total affiché au-dessus
 * — calculé côté client car GET /revenue-time-series attend un from/to
 * explicite plutôt qu'un mot-clé de période.
 */
export function windowForPeriod(period: CommissionSummaryPeriod, now: Date = new Date()): PeriodWindow {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  switch (period) {
    case 'week': {
      const day = start.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      start.setDate(start.getDate() - diffToMonday);
      return { granularity: 'day', from: start.toISOString(), to: now.toISOString() };
    }
    case 'month': {
      start.setDate(1);
      return { granularity: 'day', from: start.toISOString(), to: now.toISOString() };
    }
    case 'quarter': {
      const quarterStartMonth = Math.floor(start.getMonth() / 3) * 3;
      start.setMonth(quarterStartMonth, 1);
      return { granularity: 'week', from: start.toISOString(), to: now.toISOString() };
    }
    case 'year': {
      start.setMonth(0, 1);
      return { granularity: 'month', from: start.toISOString(), to: now.toISOString() };
    }
  }
}