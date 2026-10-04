// backend/src/common/observability/sentry.config.ts
//
// Suivi des erreurs (Sentry) — partie pure : options du SDK et nettoyage des événements. Rien ici ne s'exécute au démarrage
// (voir src/instrument.ts) ; tout est testable sans réseau.
//
// Désactivé tant que SENTRY_DSN est absent : sans cette variable, le backend ne contacte pas Sentry et ne change pas de
// comportement.
import type { ErrorEvent, NodeOptions } from '@sentry/nestjs';

/** Rien de ce qui peut contenir une donnée personnelle ou un secret n'est collecté. */
export const DATA_COLLECTION: NonNullable<NodeOptions['dataCollection']> = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
};

/** Part des requêtes tracées (0 à 1). 0 par défaut : le plan gratuit compte aussi les traces dans son quota. */
function sampleRate(raw: string | undefined): number {
  const value = Number(raw ?? 0);
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Options du SDK, ou null si SENTRY_DSN est absent (suivi désactivé).
 *  - SENTRY_ENVIRONMENT : « production », « staging »… (par défaut NODE_ENV) ;
 *  - SENTRY_RELEASE : version déployée (par défaut le commit Render, si disponible) ;
 *  - SENTRY_TRACES_SAMPLE_RATE : traçage des performances, désactivé (0) par défaut.
 */
export function buildSentryOptions(env: NodeJS.ProcessEnv): NodeOptions | null {
  const dsn = env.SENTRY_DSN?.trim();
  if (!dsn) return null;
  return {
    dsn,
    environment: env.SENTRY_ENVIRONMENT?.trim() || env.NODE_ENV || 'development',
    release: env.SENTRY_RELEASE?.trim() || env.RENDER_GIT_COMMIT || undefined,
    tracesSampleRate: sampleRate(env.SENTRY_TRACES_SAMPLE_RATE),
    // Cette version du SDK collecte beaucoup PAR DÉFAUT (corps des requêtes, cookies, en-têtes, paramètres d'URL, adresse IP,
    // valeurs des variables locales dans la pile d'appels, données des requêtes SQL). L'app manipule des numéros de téléphone,
    // des codes à usage unique et des montants : on coupe tout, et seul l'identifiant du compte est ajouté à la main (voir
    // GlobalExceptionFilter). `scrubEvent` ci-dessous est une seconde barrière avant l'envoi.
    dataCollection: DATA_COLLECTION,
    beforeSend: scrubEvent,
  };
}

const SENSITIVE_HEADERS = new Set(['authorization', 'cookie', 'set-cookie', 'x-forwarded-for', 'x-real-ip']);

/**
 * Retire d'un événement tout ce qui peut contenir une donnée personnelle ou un secret avant envoi : corps de la requête (codes
 * OTP, mots de passe, numéros), cookies, en-têtes d'authentification, paramètres d'URL, adresse IP.
 * Ce qui reste suffit à comprendre l'erreur : message, pile d'appels, méthode, chemin, identifiant du compte (posé par le filtre).
 */
export function scrubEvent<T extends ErrorEvent>(event: T): T {
  const request = event.request;
  if (request) {
    delete request.data;
    delete request.cookies;
    delete request.query_string;
    if (request.url) request.url = request.url.split('?')[0];
    if (request.headers) {
      for (const name of Object.keys(request.headers)) {
        if (SENSITIVE_HEADERS.has(name.toLowerCase())) delete request.headers[name];
      }
    }
  }
  if (event.user) {
    delete event.user.ip_address;
    delete event.user.email;
    delete event.user.username;
  }
  return event;
}
