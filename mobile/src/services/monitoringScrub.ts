// mobile/src/services/monitoringScrub.ts
//
// Suivi des erreurs (Sentry) — partie pure : nettoyage de ce qui part vers Sentry. Aucun import natif, donc vérifiable hors de
// l'application. L'app manipule des numéros de téléphone, des codes à usage unique, des adresses et des montants : seul ce qui sert
// à comprendre un plantage doit partir (message, pile d'appels, écran, version, modèle de téléphone, identifiant du compte).
import type { Breadcrumb, ErrorEvent } from '@sentry/react-native';

/** « https://api/x?phone=+224… » → « https://api/x » : les paramètres d'URL peuvent contenir un numéro ou un code. */
export function stripQuery(url: string): string {
  return url.split('?')[0].split('#')[0];
}

/** Retire de l'événement les champs personnels éventuels (adresse IP, e-mail, nom) et les restes de requête HTTP. */
export function scrubEvent<T extends ErrorEvent>(event: T): T {
  if (event.user) {
    delete event.user.ip_address;
    delete event.user.email;
    delete event.user.username;
  }
  const request = event.request;
  if (request) {
    delete request.data;
    delete request.cookies;
    delete request.query_string;
    delete request.headers;
    if (request.url) request.url = stripQuery(request.url);
  }
  return event;
}

/**
 * Les « miettes de pain » (ce qui s'est passé avant le plantage) :
 *  - les messages de la console sont supprimés (un `console.log` de débogage peut contenir un numéro ou un code) ;
 *  - les appels réseau gardent méthode, adresse sans paramètres et statut — jamais le corps ;
 *  - les changements d'écran gardent le chemin sans paramètres.
 */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category === 'console') return null;

  const data = breadcrumb.data as Record<string, unknown> | undefined;
  if (data) {
    if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
      if (typeof data.url === 'string') data.url = stripQuery(data.url);
      delete data.request_body;
      delete data.response_body;
    }
    if (breadcrumb.category === 'navigation') {
      for (const key of ['from', 'to'] as const) {
        if (typeof data[key] === 'string') data[key] = stripQuery(data[key] as string);
      }
    }
  }
  return breadcrumb;
}
