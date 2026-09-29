// web-admin/src/components/dashboard/RevenueChart.tsx
'use client';

import React from 'react';
import type { RevenueGranularity, RevenueTimeSeriesPoint } from '@/types/dashboards.types';

const MAX_BARS = 10;

/**
 * Clé de correspondance d'une période, alignée sur le début de son
 * intervalle (jour, semaine calée sur lundi, mois, année) — utilisée
 * pour faire correspondre un point réel de l'API à une période générée
 * par generatePeriods, quelle que soit l'heure exacte du timestamp reçu.
 */
function periodKey(iso: string, granularity: RevenueGranularity): string {
  const date = new Date(iso);
  switch (granularity) {
    case 'day':
      return date.toISOString().slice(0, 10);
    case 'week': {
      const day = date.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      const monday = new Date(date);
      monday.setDate(monday.getDate() - diffToMonday);
      return monday.toISOString().slice(0, 10);
    }
    case 'month':
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    case 'year':
      return String(date.getFullYear());
  }
}

/** Liste des dates de début de chaque période (jour/semaine/mois) entre `from` et `to` inclus. */
function generatePeriods(from: string, to: string, granularity: RevenueGranularity): string[] {
  const end = new Date(to);
  const cursor = new Date(from);
  const periods: string[] = [];

  while (cursor <= end) {
    periods.push(cursor.toISOString());
    switch (granularity) {
      case 'day':
        cursor.setDate(cursor.getDate() + 1);
        break;
      case 'week':
        cursor.setDate(cursor.getDate() + 7);
        break;
      case 'month':
        cursor.setMonth(cursor.getMonth() + 1);
        break;
      case 'year':
        cursor.setFullYear(cursor.getFullYear() + 1);
        break;
    }
  }
  return periods;
}

/**
 * L'API ne renvoie qu'un point pour les périodes où une commission a
 * réellement été générée — un mois avec une seule journée d'activité ne
 * renvoie donc qu'un seul point. Sans comblement, ce point unique occupe
 * 100 % du graphique et ressemble à un bloc plein plutôt qu'à une barre
 * isolée au milieu d'un mois calme. On reconstruit ici la série complète
 * attendue entre `from` et `to`, avec une commission à 0 pour chaque
 * période absente de la réponse de l'API.
 */
function fillGaps(points: RevenueTimeSeriesPoint[], granularity: RevenueGranularity, from?: string, to?: string): RevenueTimeSeriesPoint[] {
  if (!from || !to) return points;
  const byKey = new Map(points.map((p) => [periodKey(p.period, granularity), p]));
  return generatePeriods(from, to, granularity).map((iso) => byKey.get(periodKey(iso, granularity)) ?? { period: iso, commission: '0' });
}

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
  /** Bornes de la fenêtre demandée (ISO). Sert à combler les périodes sans commission — voir fillGaps. */
  from?: string;
  to?: string;
}

/**
 * Graphique en barres autonome (SVG/CSS pur), au plus MAX_BARS barres
 * (voir aggregatePoints). L'état vide reste DANS le conteneur de
 * hauteur fixe (h-20/h-24) plutôt que dans un paragraphe à part avec
 * son propre padding — évite le bloc d'espace mort qu'on avait avant
 * quand la période n'a aucune donnée.
 *
 * Chaque colonne s'étire sur toute la hauteur du conteneur (comportement
 * par défaut du flex, items-stretch) puis aligne son contenu en bas
 * (flex-col justify-end) : la hauteur en pourcentage posée sur la barre
 * a ainsi une vraie référence pour se calculer. Avec items-end sur le
 * conteneur parent (ancienne version), chaque colonne se dimensionnait
 * sur son propre contenu — donc sur la hauteur de la barre elle-même —
 * ce qui rendait la hauteur en pourcentage circulaire : elle se
 * résolvait toujours à 0, et aucune barre n'était jamais visible, quelle
 * que soit la donnée.
 */
export function RevenueChart({ points, granularity, from, to }: RevenueChartProps) {
  const filledPoints = fillGaps(points, granularity, from, to);
  const displayPoints = aggregatePoints(filledPoints, MAX_BARS);
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
      <div className="flex h-20 gap-1.5 sm:h-24">
        {!hasData ? (
          <p className="w-full self-center text-center text-xs text-white/50">Aucune donnée sur cette période</p>
        ) : (
          displayPoints.map((point) => {
            const value = Number(point.commission);
            const heightPercent = value > 0 ? Math.max((value / max) * 100, 8) : 0;
            return (
              <div
                key={point.period}
                className="group relative flex flex-1 flex-col justify-end"
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