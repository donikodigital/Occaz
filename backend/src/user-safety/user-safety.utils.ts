// backend/src/user-safety/user-safety.utils.ts
// [11/10/2026] v1 — petits outils partagés par les services de sécurité (noms affichés, lien de carte, libellés).
import { UserReportReason } from '@prisma/client';

export const REPORT_REASON_LABELS: Record<UserReportReason, string> = {
  HARASSMENT: 'Harcèlement ou propos déplacés',
  UNSAFE_BEHAVIOR: 'Comportement dangereux',
  FRAUD: 'Fraude ou arnaque',
  NO_SHOW: 'Absence au rendez-vous',
  FAKE_PROFILE: 'Faux profil',
  INAPPROPRIATE_CONTENT: 'Contenu inapproprié',
  OTHER: 'Autre motif',
};

type NamedUser = {
  phone?: string | null;
  customerProfile?: { firstName: string; lastName: string } | null;
  driverProfile?: { firstName: string; lastName: string } | null;
};

/** « Fatoumata D. » : le prénom et l'initiale du nom, jamais le nom complet, pour les listes vues par un autre utilisateur. */
export function shortName(user: NamedUser): string {
  const profile = user.customerProfile ?? user.driverProfile;
  if (!profile) return 'Utilisateur Occa’Z';
  const initial = profile.lastName.trim().charAt(0);
  return initial ? `${profile.firstName.trim()} ${initial.toUpperCase()}.` : profile.firstName.trim();
}

/** Nom complet, réservé au personnel du support. */
export function fullName(user: NamedUser): string {
  const profile = user.customerProfile ?? user.driverProfile;
  return profile ? `${profile.firstName} ${profile.lastName}`.trim() : 'Sans profil';
}

/** Lien de carte vers une position, pour les SMS et le back-office. */
export function mapsLink(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}
