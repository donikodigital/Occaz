// mobile/src/utils/milestones.ts
//
// Paliers pour l'anneau "Trajets terminés" du dashboard chauffeur —
// progression relative entre le palier précédent et le suivant plutôt
// qu'un pourcentage absolu arbitraire, pour que l'anneau ait du sens à
// n'importe quel stade (un chauffeur à 3 trajets voit une vraie
// progression vers 10, pas un anneau quasi vide jusqu'à 100).
const TRIP_MILESTONES = [10, 25, 50, 100, 250, 500, 1000] as const;

export interface MilestoneProgress {
  /** 0 à 1 — à utiliser directement dans <ProgressRing progress={...}>. */
  progress: number;
  /** Prochain palier à atteindre, ou null si le dernier palier est dépassé. */
  nextMilestone: number | null;
}

export function getTripMilestoneProgress(completedTripsCount: number): MilestoneProgress {
  const count = Math.max(0, completedTripsCount);

  const nextMilestone = TRIP_MILESTONES.find((milestone) => milestone > count) ?? null;
  if (nextMilestone === null) {
    // Dernier palier dépassé — anneau plein plutôt qu'une valeur
    // supérieure à 1 qui n'aurait pas de sens visuellement.
    return { progress: 1, nextMilestone: null };
  }

  const previousMilestone = [...TRIP_MILESTONES].reverse().find((milestone) => milestone <= count) ?? 0;
  const progress = (count - previousMilestone) / (nextMilestone - previousMilestone);

  return { progress, nextMilestone };
}