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

          {/* Une carte par devise active (GNF, XOF…), toujours côte à côte
              même sur le plus petit mobile — jamais une somme des deux,
              qui mélangerait des unités différentes sans signification. */}
          <div className="mt-2 grid grid-cols-2 gap-2.5 sm:gap-3">
            {summary.current.byCurrency.map((figures, index) => {
              const previousFigures = summary.previous.byCurrency.find((item) => item.currencyId === figures.currencyId);
              const trend = previousFigures
                ? trendPercent(Number(figures.totalCommission), Number(previousFigures.totalCommission))
                : null;

              return (
                <div
                  key={figures.currencyId}
                  className="animate-in rounded-xl border border-white/15 bg-white/10 p-3 opacity-0 shadow-lg shadow-primary-dark/20 backdrop-blur-sm sm:rounded-2xl sm:p-4"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <p className="text-[11px] font-bold uppercase tracking-wide text-white/60 sm:text-xs">{figures.isoCode}</p>
                  <div className="mt-0.5 flex flex-wrap items-baseline gap-1.5">
                    <p className="text-xl font-bold tracking-tight tabular-nums sm:text-2xl">
                      {formatMoney(figures.totalCommission, figures.isoCode)}
                    </p>
                    {trend !== null ? (
                      <span
                        className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold sm:text-xs ${
                          trend >= 0 ? 'bg-success-light text-success-dark' : 'bg-danger-light text-danger-dark'
                        }`}
                      >
                        {trend >= 0 ? <IconArrowUpRight size={11} /> : <IconArrowDownRight size={11} />}
                        {Math.abs(trend)} %
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[10px] text-white/60 sm:text-xs">
                    {formatMoney(previousFigures?.totalCommission ?? '0', figures.isoCode)} {PERIOD_LABELS[period].sublabel}
                  </p>
                  <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-1.5">
                    <span className="rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-medium sm:px-3 sm:py-1 sm:text-[11px]">
                      Trajets : {formatMoney(figures.bookingCommission, figures.isoCode)}
                    </span>
                    <span className="rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-medium sm:px-3 sm:py-1 sm:text-[11px]">
                      Envois : {formatMoney(figures.shipmentCommission, figures.isoCode)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {seriesLoading || !series ? (
            <div className="mt-3 h-6 w-1/2 animate-pulse rounded bg-white/10" />
          ) : series.length > 0 ? (
            <div className="mt-3">
              <RevenueChart points={series} granularity={window.granularity} />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}