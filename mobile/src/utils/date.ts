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

/** Date au format YYYY-MM-DD attendu par SearchTripsDto.departureDate côté backend. */
export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
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
