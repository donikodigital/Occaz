// backend/src/i18n/texts/index.ts
// [30/10/2026] v1 — Tous les textes traduits du serveur : [français, anglais, portugais (Portugal)].
// Un fichier par domaine ; le français est la clé (voir server-text.ts). Les trous {0}, {1}… sont numérotés dans l'ordre du texte français
// (un trou {#0} n'accepte que des chiffres). « errors-* » : messages d'erreur de l'API ; « texts-* » : notifications, e-mails, SMS et PDF.
// Pour ajouter un texte : une ligne dans le fichier du domaine ; le test texts.spec.ts vérifie la cohérence des trous.
export type TextRow = readonly [fr: string, en: string, pt: string];

import { ERRORS_AUTH } from './errors-auth';
import { ERRORS_COMMON } from './errors-common';
import { ERRORS_CONVERSATIONS } from './errors-conversations';
import { ERRORS_DEVICES } from './errors-devices';
import { ERRORS_DISPUTES } from './errors-disputes';
import { ERRORS_DOCUMENTS } from './errors-documents';
import { ERRORS_LOCATIONS } from './errors-locations';
import { ERRORS_NOTIFICATIONS } from './errors-notifications';
import { ERRORS_OTP } from './errors-otp';
import { ERRORS_PAYMENTS } from './errors-payments';
import { ERRORS_PRICING } from './errors-pricing';
import { ERRORS_PROFILES } from './errors-profiles';
import { ERRORS_PROMO_CODES } from './errors-promo-codes';
import { ERRORS_RATINGS } from './errors-ratings';
import { ERRORS_REFERRALS } from './errors-referrals';
import { ERRORS_SAVED_CARDS } from './errors-saved-cards';
import { ERRORS_SHIPMENTS } from './errors-shipments';
import { ERRORS_TICKETS } from './errors-tickets';
import { ERRORS_TRACKING } from './errors-tracking';
import { ERRORS_TRIPS } from './errors-trips';
import { ERRORS_USER_SAFETY } from './errors-user-safety';
import { ERRORS_USERS } from './errors-users';
import { ERRORS_VEHICLES } from './errors-vehicles';
import { ERRORS_WALLETS } from './errors-wallets';
import { TEXTS_AUTH } from './texts-auth';
import { TEXTS_COMPLIANCE } from './texts-compliance';
import { TEXTS_DISPUTES } from './texts-disputes';
import { TEXTS_DTO } from './texts-dto';
import { TEXTS_PAYMENTS } from './texts-payments';
import { TEXTS_PURGE } from './texts-purge';
import { TEXTS_SHIPMENTS } from './texts-shipments';
import { TEXTS_SOS } from './texts-sos';
import { TEXTS_TICKETS } from './texts-tickets';
import { TEXTS_TRACKING } from './texts-tracking';
import { TEXTS_TRIPS } from './texts-trips';

export const TEXTS: readonly TextRow[] = [
  ...ERRORS_AUTH,
  ...ERRORS_COMMON,
  ...ERRORS_CONVERSATIONS,
  ...ERRORS_DEVICES,
  ...ERRORS_DISPUTES,
  ...ERRORS_DOCUMENTS,
  ...ERRORS_LOCATIONS,
  ...ERRORS_NOTIFICATIONS,
  ...ERRORS_OTP,
  ...ERRORS_PAYMENTS,
  ...ERRORS_PRICING,
  ...ERRORS_PROFILES,
  ...ERRORS_PROMO_CODES,
  ...ERRORS_RATINGS,
  ...ERRORS_REFERRALS,
  ...ERRORS_SAVED_CARDS,
  ...ERRORS_SHIPMENTS,
  ...ERRORS_TICKETS,
  ...ERRORS_TRACKING,
  ...ERRORS_TRIPS,
  ...ERRORS_USER_SAFETY,
  ...ERRORS_USERS,
  ...ERRORS_VEHICLES,
  ...ERRORS_WALLETS,
  ...TEXTS_AUTH,
  ...TEXTS_COMPLIANCE,
  ...TEXTS_DISPUTES,
  ...TEXTS_DTO,
  ...TEXTS_PAYMENTS,
  ...TEXTS_PURGE,
  ...TEXTS_SHIPMENTS,
  ...TEXTS_SOS,
  ...TEXTS_TICKETS,
  ...TEXTS_TRACKING,
  ...TEXTS_TRIPS,
];
