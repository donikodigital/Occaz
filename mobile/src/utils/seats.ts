// mobile/src/utils/seats.ts

/**
 * Formulation unique de la disponibilité des places : « Complet »,
 * « 1 place libre » ou « 3 places libres ». À utiliser partout où l'on
 * affiche `availableSeats`, pour qu'un même trajet ne soit jamais lu
 * différemment d'un écran à l'autre (« 0/2 places » se lisait aussi bien
 * « 0 libre » que « 0 réservée »).
 */
export function formatSeatsAvailability(availableSeats: number): string {
  if (availableSeats <= 0) return 'Complet';
  const plural = availableSeats > 1 ? 's' : '';
  return `${availableSeats} place${plural} libre${plural}`;
}