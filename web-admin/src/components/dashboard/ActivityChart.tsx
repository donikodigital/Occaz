// web-admin/src/components/dashboard/ActivityChart.tsx
'use client';

import React from 'react';
import type { ActivityTimeSeriesPoint, RevenueGranularity } from '@/types/dashboards.types';

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

export interface ActivityChartProps {
  points: ActivityTimeSeriesPoint[];
  granularity: RevenueGranularity;
}

/**
 * Deux barres par période (trajets / envois), sur fond clair — pendant
 * de RevenueChart (dégradé blanc sur fond sombre), mais bicolore et posé
 * sur une carte blanche plutôt que dans le bandeau bleu océan.
 */
export function ActivityChart({ points, granularity }: ActivityChartProps) {
  const max = Math.max(...points.map((p) => Math.max(p.tripsCount, p.shipmentsCount)), 1);
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-xs font-medium text-text-secondary">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
          Trajets
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" />
          Envois
        </span>
      </div>

      <div className="flex h-32 items-end gap-1.5 sm:h-40">
        {points.length === 0 ? (
          <p className="w-full self-center text-center text-xs text-text-muted">Aucune donnée sur cette période</p>
        ) : (
          points.map((point) => {
            const tripsHeight = point.tripsCount > 0 ? Math.max((point.tripsCount / max) * 100, 4) : 0;
            const shipmentsHeight = point.shipmentsCount > 0 ? Math.max((point.shipmentsCount / max) * 100, 4) : 0;
            return (
              <div
                key={point.period}
                className="group flex flex-1 items-end justify-center gap-0.5"
                title={`${formatBucketLabel(point.period, granularity)} — ${point.tripsCount} trajet${point.tripsCount > 1 ? 's' : ''}, ${point.shipmentsCount} envoi${point.shipmentsCount > 1 ? 's' : ''}`}
              >
                <div className="w-full rounded-t-md bg-primary/70 transition-colors group-hover:bg-primary" style={{ height: `${tripsHeight}%` }} />
                <div className="w-full rounded-t-md bg-accent/70 transition-colors group-hover:bg-accent" style={{ height: `${shipmentsHeight}%` }} />
              </div>
            );
          })
        )}
      </div>

      {points.length > 0 ? (
        <div className="mt-1.5 flex gap-1.5">
          {points.map((point, index) => (
            <div key={point.period} className="flex-1 text-center">
              {index % labelEvery === 0 ? (
                <span className="text-[9px] text-text-muted">{formatBucketLabel(point.period, granularity)}</span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}