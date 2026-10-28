// mobile/src/utils/seats.ts
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.

/**
 * Formulation unique de la disponibilité des places : « Complet »,
 * « 1 place libre » ou « 3 places libres ». À utiliser partout où l'on
 * affiche `availableSeats`, pour qu'un même trajet ne soit jamais lu
 * différemment d'un écran à l'autre (« 0/2 places » se lisait aussi bien
 * « 0 libre » que « 0 réservée »).
 */
import { translate, translateN } from '@/i18n';
export function formatSeatsAvailability(availableSeats: number): string {
  if (availableSeats <= 0) return translate('Complet');
  return translateN(availableSeats, '{count} place libre', '{count} places libres');
}