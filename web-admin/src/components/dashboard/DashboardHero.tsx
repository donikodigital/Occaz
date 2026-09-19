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

function trendPercent(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? null : 100;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Carte de mise en avant — total de commissions de la période + variation,
 * graphique en dessous. Quand la période n'a aucune donnée (series vide),
 * on n'affiche plus la grande zone de graphique vide : juste une ligne de
 * texte compacte, pour ne pas gonfler la carte avec de l'espace mort.
 */
export function DashboardHero() {
  const [period, setPeriod] = useState<CommissionSummaryPeriod>('month');

  const { data: summary, isLoading: summaryLoading, isError: summaryError } = useCommissionSummary(period);

  const window = useMemo(() => windowForPeriod(period), [period]);
  const { data: series, isLoading: seriesLoading } = useRevenueTimeSeries(window.granularity, window.from, window.to);

  const trend = summary ? trendPercent(Number(summary.current.totalCommission), Number(summary.previous.totalCommission)) : null;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary-dark p-5 text-white shadow-xl shadow-primary-dark/30 sm:p-6">
      <IconCoinFilled size={110} className="pointer-events-none absolute -right-4 -top-4 text-white/10" />

      <div className="mb-3 flex gap-1.5">
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
          <p className="text-xs font-medium text-white/75 sm:text-sm">Commissions — {PERIOD_LABELS[period].tab.toLowerCase()} en cours</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <p className="text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">{formatMoney(summary.current.totalCommission)}</p>
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
          <p className="text-xs text-white/60 sm:text-sm">
            {formatMoney(summary.previous.totalCommission)} {PERIOD_LABELS[period].sublabel}
          </p>

          {seriesLoading || !series ? (
            <div className="mt-3 h-6 w-1/2 animate-pulse rounded bg-white/10" />
          ) : series.length > 0 ? (
            <div className="mt-3">
              <RevenueChart points={series} granularity={window.granularity} />
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium backdrop-blur-sm sm:text-xs">
              Trajets : {formatMoney(summary.current.bookingCommission)}
            </span>
            <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium backdrop-blur-sm sm:text-xs">
              Envois : {formatMoney(summary.current.shipmentCommission)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}