// backend/src/instrument.ts
//
// Démarre le suivi des erreurs (Sentry). Importé en TOUT PREMIER dans main.ts : le SDK doit être actif avant le chargement des
// autres modules pour observer les erreurs qui n'y sont pas rattrapées (rejets de promesses, exceptions non gérées).
//
// Sans SENTRY_DSN, ce fichier ne fait rien : le backend se comporte exactement comme avant.
import * as Sentry from '@sentry/nestjs';
import { buildSentryOptions } from './common/observability/sentry.config';

const options = buildSentryOptions(process.env);
if (options) {
  Sentry.init(options);
}
