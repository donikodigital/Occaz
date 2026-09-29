// web-admin/src/components/dashboard/RevenueChart.tsx
'use client';

import React from 'react';
import type { RevenueGranularity, RevenueTimeSeriesPoint } from '@/types/dashboards.types';

const MAX_BARS = 10;

/**
 * Regroupe les points en au plus `maxBars` barres (somme des commissions
 * du groupe) — sans ça, la granularité "jour" sur un mois donne ~28-30
 * barres si fines (quelques pixels chacune sur un mobile étroit) qu'une
 * seule barre haute au milieu des autres à 0 devient visuellement
 * imperceptible, même avec un fort contraste. Regrouper élargit chaque
 * barre et rend la variation réellement lisible. BigInt pour la somme
 * (jamais Number() sur des montants cumulés, cf. sumMoney).
 */
function aggregatePoints(points: RevenueTimeSeriesPoint[], maxBars: number): RevenueTimeSeriesPoint[] {
  if (points.length <= maxBars) return points;
  const bucketSize = Math.ceil(points.length / maxBars);
  const buckets: RevenueTimeSeriesPoint[] = [];
  for (let i = 0; i < points.length; i += bucketSize) {
    const slice = points.slice(i, i + bucketSize);
    const sum = slice.reduce((acc, p) => acc + BigInt(p.commission || '0'), BigInt(0));
    // Date du dernier jour du groupe — plus parlant qu'une moyenne ou le
    // premier jour pour un lecteur qui regarde surtout où on en est.
    buckets.push({ period: slice[slice.length - 1].period, commission: sum.toString() });
  }
  return buckets;
}

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
 * Graphique en barres autonome (SVG/CSS pur), au plus MAX_BARS barres
 * (voir aggregatePoints). L'état vide reste DANS le conteneur de
 * hauteur fixe (h-20/h-24) plutôt que dans un paragraphe à part avec
 * son propre padding — évite le bloc d'espace mort qu'on avait avant
 * quand la période n'a aucune donnée.
 */
export function RevenueChart({ points, granularity }: RevenueChartProps) {
  const displayPoints = aggregatePoints(points, MAX_BARS);
  const values = displayPoints.map((p) => Number(p.commission));
  const max = Math.max(...values, 1);
  const labelEvery = Math.max(1, Math.ceil(displayPoints.length / 8));
  // Des points existent mais valent tous 0 (ex. tout début de période) :
  // chaque barre a alors une hauteur nulle, invisible — un grand
  // rectangle vide sans aucune barre, ce que le message d'état vide est
  // censé remplacer. Sans ce cas, seul un tableau réellement vide
  // déclenchait ce message.
  const hasData = values.some((value) => value > 0);

  return (
    <div>
      <div className="flex h-20 items-end gap-1.5 sm:h-24">
        {!hasData ? (
          <p className="w-full self-center text-center text-xs text-white/50">Aucune donnée sur cette période</p>
        ) : (
          displayPoints.map((point) => {
            const value = Number(point.commission);
            const heightPercent = value > 0 ? Math.max((value / max) * 100, 8) : 0;
            return (
              <div
                key={point.period}
                className="group relative flex-1"
                title={`${formatBucketLabel(point.period, granularity)} : ${value.toLocaleString('fr-FR')} GNF`}
              >
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-white/40 to-white/90 transition-colors group-hover:to-white"
                  style={{ height: `${heightPercent}%` }}
                />
              </div>
            );
          })
        )}
      </div>
      {hasData ? (
        <div className="mt-1.5 flex gap-1.5">
          {displayPoints.map((point, index) => (
            <div key={point.period} className="flex-1 text-center">
              {index % labelEvery === 0 ? <span className="text-[9px] text-white/50">{formatBucketLabel(point.period, granularity)}</span> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}