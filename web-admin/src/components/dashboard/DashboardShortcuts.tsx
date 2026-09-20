// web-admin/src/components/dashboard/DashboardHero.tsx
'use client';

import React, { useMemo, useState } from 'react';
import { IconArrowDownRight, IconArrowUpRight, IconCoinFilled } from '@tabler/icons-react';
import { useCommissionSummary } from '@/hooks/useCommissionSummary';
import { useRevenueTimeSeries } from '@/hooks/useRevenueTimeSeries';
import { windowForPeriod } from './periodWindows';
import { RevenueChart } from './RevenueChart';
import { formatMoney } from '@/utils/money';
import type { CommissionSummaryPeriod } from '@/types/dashboards.types';

const PERIOD_LABELS: Record<CommissionSummaryPeriod, { tab: string; sublabel: string }> = {
  week: { tab: 'Semaine', sublabel: 'la semaine précédente' },
  month: { tab: 'Mois', sublabel: 'le mois précédent' },
  quarter: { tab: 'Trimestre', sublabel: 'le trimestre précédent' },
  year: { tab: 'Année', sublabel: "l'année précédente" },
};

const PERIODS: CommissionSummaryPeriod[] = ['week', 'month', 'quarter', 'year'];

/** Calcule la variation en % entre deux montants ; null si aucune comparaison n'a de sens (rien à comparer). */
function trendPercent(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? null : 100;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Carte de mise en avant, façon Tiime — total de commissions de la
 * période sélectionnée + comparaison à la période précédente, avec un
 * graphique en dessous. Ombre colorée (shadow-primary-dark/30) pour un
 * effet de profondeur — seule exception au "jamais d'ombre" du reste de
 * l'admin, scopée à cette carte.
 */
export function DashboardHero() {
  const [period, setPeriod] = useState<CommissionSummaryPeriod>('month');

  const { data: summary, isLoading: summaryLoading, isError: summaryError } = useCommissionSummary(period);

  const window = useMemo(() => windowForPeriod(period), [period]);
  const { data: series, isLoading: seriesLoading } = useRevenueTimeSeries(window.granularity, window.from, window.to);

  const trend = summary ? trendPercent(Number(summary.current.totalCommission), Number(summary.previous.totalCommission)) : null;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary-dark p-6 text-white shadow-xl shadow-primary-dark/30 duration-500 sm:p-8">
      <IconCoinFilled size={140} className="pointer-events-none absolute -right-6 -top-6 text-white/10" />

      <div className="mb-4 flex gap-1.5">
        {PERIODS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setPeriod(value)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              value === period ? 'bg-white text-primary-dark' : 'bg-white/15 text-white hover:bg-white/25'
            }`}
          >
            {PERIOD_LABELS[value].tab}
          </button>
        ))}
      </div>

      {summaryError ? (
        <p className="text-sm text-white/80">Impossible de charger les commissions.</p>
      ) : summaryLoading || !summary ? (
        <p className="text-sm text-white/80">Chargement…</p>
      ) : (
        <>
          <p className="text-sm font-medium text-white/80">Commissions — {PERIOD_LABELS[period].tab.toLowerCase()} en cours</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-2.5">
            <p className="text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">{formatMoney(summary.current.totalCommission)}</p>
            {trend !== null ? (
              <span
                className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  trend >= 0 ? 'bg-success-light text-success-dark' : 'bg-danger-light text-danger-dark'
                }`}
              >
                {trend >= 0 ? <IconArrowUpRight size={13} /> : <IconArrowDownRight size={13} />}
                {Math.abs(trend)} %
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-sm text-white/70">
            {formatMoney(summary.previous.totalCommission)} {PERIOD_LABELS[period].sublabel}
          </p>

          <div className="mt-4">
            {seriesLoading || !series ? (
              <div className="h-28 animate-pulse rounded-lg bg-white/10 sm:h-32" />
            ) : (
              <RevenueChart points={series} granularity={window.granularity} />
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
              Trajets : {formatMoney(summary.current.bookingCommission)}
            </span>
            <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
              Envois : {formatMoney(summary.current.shipmentCommission)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}