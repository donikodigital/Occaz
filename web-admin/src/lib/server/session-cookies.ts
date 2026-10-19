// web-admin/src/lib/server/session-cookies.ts
// [19/10/2026] v1 — Cookies de session du back-office, posés et lus UNIQUEMENT par le serveur Next (relais /api/bff).
//
// Pourquoi : les jetons de connexion étaient gardés dans le localStorage du navigateur, lisible par n'importe quel script de la page — une
// seule faille d'injection (XSS) suffisait à voler la session d'un administrateur. Ils vivent désormais dans des cookies HttpOnly :
// JavaScript ne peut plus les lire, même si un script malveillant s'exécute dans la page.
//   • occaz_at : jeton d'accès (courte durée)       • occaz_rt : jeton de rafraîchissement (longue durée)
//   • HttpOnly + SameSite=Strict (jamais envoyés depuis un autre site) + Secure en https + Path=/api/bff (jamais envoyés avec les pages).
// Code serveur seulement : n'importe pas ce fichier depuis un composant client.

export const ACCESS_COOKIE = 'occaz_at';
export const REFRESH_COOKIE = 'occaz_rt';
export const COOKIE_PATH = '/api/bff';

const DEFAULT_ACCESS_SECONDS = 15 * 60;
const DEFAULT_REFRESH_SECONDS = 7 * 24 * 3600;
const MIN_SECONDS = 60;

/** Valeur d'un cookie dans l'en-tête « Cookie » d'une requête. */
export function readCookie(header: string | null | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      const value = part.slice(index + 1).trim();
      return value || undefined;
    }
  }
  return undefined;
}

/** Secondes restantes avant l'expiration d'un JWT (champ « exp »), ou `fallback` si illisible. Jamais moins de 60 s ni plus de 90 jours. */
export function secondsUntilExpiry(jwt: string, fallback: number, now: number = Date.now()): number {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1] ?? '', 'base64url').toString('utf8')) as { exp?: unknown };
    if (typeof payload.exp === 'number' && Number.isFinite(payload.exp)) {
      const seconds = Math.floor(payload.exp - now / 1000);
      return Math.min(Math.max(seconds, MIN_SECONDS), 90 * 24 * 3600);
    }
  } catch {
    // jeton illisible : durée par défaut
  }
  return fallback;
}

function serialize(name: string, value: string, maxAge: number, secure: boolean): string {
  return `${name}=${value}; Path=${COOKIE_PATH}; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

/** Les deux en-têtes « Set-Cookie » qui ouvrent (ou renouvellent) une session. */
export function sessionCookies(tokens: { accessToken: string; refreshToken: string }, secure: boolean, now: number = Date.now()): string[] {
  return [
    serialize(ACCESS_COOKIE, tokens.accessToken, secondsUntilExpiry(tokens.accessToken, DEFAULT_ACCESS_SECONDS, now), secure),
    serialize(REFRESH_COOKIE, tokens.refreshToken, secondsUntilExpiry(tokens.refreshToken, DEFAULT_REFRESH_SECONDS, now), secure),
  ];
}

/** Les deux en-têtes « Set-Cookie » qui ferment la session. */
export function clearedSessionCookies(secure: boolean): string[] {
  return [serialize(ACCESS_COOKIE, '', 0, secure), serialize(REFRESH_COOKIE, '', 0, secure)];
}

/** La requête est-elle arrivée en https (directement ou derrière le répartiteur de charge de l'hébergeur) ? */
export function isSecureRequest(headers: Headers, url: string): boolean {
  const forwarded = headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  return (forwarded ?? new URL(url).protocol.replace(':', '')) === 'https';
}

/** Vrai si l'en-tête Origin d'une requête qui modifie des données est bien celui de ce site (protection contre les requêtes venues d'un autre site). */
export function isSameOrigin(headers: Headers): boolean {
  const origin = headers.get('origin');
  if (!origin) return false;
  const host = headers.get('x-forwarded-host')?.split(',')[0]?.trim() ?? headers.get('host');
  try {
    return Boolean(host) && new URL(origin).host === host;
  } catch {
    return false;
  }
}
