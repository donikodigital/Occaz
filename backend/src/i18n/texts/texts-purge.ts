// backend/src/i18n/texts/texts-purge.ts
// [30/10/2026] v1 — Textes traduits (notifications, e-mails, SMS, PDF) : [français, anglais, portugais (Portugal)].
import type { TextRow } from './index';

export const TEXTS_PURGE: readonly TextRow[] = [
  ["très bientôt", "very soon", "muito em breve"],
  ["dans 1 jour", "in 1 day", "dentro de 1 dia"],
  ["dans {0} jours", "in {0} days", "dentro de {0} dias"],
  ["Il vous reste {0} jours", "You have {0} days left", "Faltam-lhe {0} dias"],
  ["Dernier jour", "Last day", "Último dia"],
  ["Votre compte Occa'Z est suspendu depuis le {0}. Rapprochez-vous de l'administration pour vous mettre en conformité et le réactiver.", "Your Occa'Z account has been suspended since {0}. Please contact the administration to bring it into compliance and reactivate it.", "A sua conta Occa'Z está suspensa desde {0}. Contacte a administração para regularizar a situação e reativá-la."],
  ["Sans régularisation avant le {0} ({1}), votre compte et vos données seront définitivement supprimés, sans possibilité de les récupérer.", "Unless it is brought into compliance before {0} ({1}), your account and your data will be permanently deleted and cannot be recovered.", "Sem regularização antes de {0} ({1}), a sua conta e os seus dados serão eliminados definitivamente, sem possibilidade de recuperação."],
];
