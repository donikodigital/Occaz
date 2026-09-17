// mobile/src/utils/date.ts
/** Formatage français natif (Intl) — pas de dépendance date-fns pour un besoin aussi simple. */

export function formatDateShort(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(iso));
}

export function formatDateLong(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(iso));
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

/**
 * Date au format YYYY-MM-DD attendu par SearchTripsDto.departureDate
 * côté backend. Lit les composants année/mois/jour en heure LOCALE
 * (getFullYear/getMonth/getDate), jamais via toISOString() : cette
 * dernière convertit d'abord en UTC, ce qui décale la date d'un jour
 * pour tout fuseau en avance sur UTC (ex : minuit le 19 en France,
 * UTC+2, devient 22h le 18 en UTC — le calendrier renvoyait alors
 * "2026-09-18" pour une sélection du 19).
 */
export function toDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Prochains `count` jours à partir d'aujourd'hui — alimente le sélecteur de date en bandeau horizontal. */
export function upcomingDays(count: number): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() + index);
    return day;
  });
}

/** "à l'instant" / "il y a Ns" / "il y a Nmin" — suffisant ici, le composant appelant se rafraîchit déjà toutes les 10s (voir useTripPosition). */
export function formatRelativeTime(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 10) return "à l'instant";
  if (seconds < 60) return `il y a ${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  return `il y a ${minutes} min`;
}