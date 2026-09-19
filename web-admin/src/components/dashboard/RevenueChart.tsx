// web-admin/src/components/dashboard/RevenueChart.tsx
'use client';

import React from 'react';
import type { RevenueGranularity, RevenueTimeSeriesPoint } from '@/types/dashboards.types';

function formatBucketLabel(iso: string, granularity: RevenueGranularity): string {
  const date = new Date(iso);
  switch (granularity) {
    case 'day':
    case 'week':
      return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' }).format(date);
    case 'month':
      return new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(date);
    case 'year':
      return new Intl.DateTimeFormat('fr-FR', { year: 'numeric' }).format(date);
  }
}

export interface RevenueChartProps {
  points: RevenueTimeSeriesPoint[];
  granularity: RevenueGranularity;
}

/**
 * Graphique en barres autonome (SVG/CSS pur). L'état vide reste DANS le
 * conteneur de hauteur fixe (h-28/h-32) plutôt que dans un paragraphe à
 * part avec son propre padding — évite le bloc d'espace mort qu'on avait
 * avant quand la période n'a aucune donnée.
 */
export function RevenueChart({ points, granularity }: RevenueChartProps) {
  const values = points.map((p) => Number(p.commission));
  const max = Math.max(...values, 1);
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));

  return (
    <div>
      <div className="flex h-28 items-end gap-1 sm:h-32">
        {points.length === 0 ? (
          <p className="w-full self-center text-center text-xs text-white/50">Aucune donnée sur cette période</p>
        ) : (
          points.map((point) => {
            const value = Number(point.commission);
            const heightPercent = value > 0 ? Math.max((value / max) * 100, 4) : 0;
            return (
              <div
                key={point.period}
                className="group relative flex-1"
                title={`${formatBucketLabel(point.period, granularity)} : ${value.toLocaleString('fr-FR')} GNF`}
              >
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-white/10 to-white/40 transition-colors group-hover:to-white/70"
                  style={{ height: `${heightPercent}%` }}
                />
              </div>
            );
          })
        )}
      </div>
      {points.length > 0 ? (
        <div className="mt-1.5 flex gap-1">
          {points.map((point, index) => (
            <div key={point.period} className="flex-1 text-center">
              {index % labelEvery === 0 ? <span className="text-[9px] text-white/50">{formatBucketLabel(point.period, granularity)}</span> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}