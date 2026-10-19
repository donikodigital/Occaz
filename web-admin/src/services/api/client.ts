// web-admin/src/services/api/client.ts
// [19/10/2026] v2 — Les appels passent par le relais serveur /api/bff (voir app/api/bff/[...path]/route.ts) : le navigateur n'a plus AUCUN jeton
// en main. La session vit dans des cookies HttpOnly que JavaScript ne peut pas lire ; le relais ajoute le jeton, le renouvelle et ne
// renvoie jamais accessToken/refreshToken dans le corps des réponses. Ce client n'a donc plus ni stockage de jeton ni logique de refresh.
import { ApiError, SessionExpiredError } from './ApiError';
import type { ApiErrorEnvelope, ApiSuccessEnvelope } from './types';

/** Chemin du relais, sur le même site que la page : aucune requête vers un autre domaine, aucun CORS. */
const BFF_BASE = '/api/bff';

let onSessionExpired: (() => void) | null = null;
export function registerSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** false pour les routes publiques (login, OTP...) — une réponse 401 n'y signifie pas « session expirée ». */
  auth?: boolean;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${BFF_BASE}/${path.replace(/^\//, '')}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return `${url.pathname}${url.search}`;
}

function formatMessage(message: string | string[]): string {
  return Array.isArray(message) ? message.join(' ') : message;
}

/** Point d'entrée unique pour tout appel réseau — même contrat que le client mobile. */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const useAuth = options.auth !== false;
  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    throw new ApiError('Connexion impossible — vérifiez votre réseau.', 0);
  }

  const json = (await response.json().catch(() => null)) as ApiSuccessEnvelope<T> | ApiErrorEnvelope | null;

  if (!response.ok || !json || json.success === false) {
    // Le relais signale « session perdue » (cookies absents ou renouvellement refusé) : retour à l'écran de connexion.
    if (useAuth && response.status === 401 && response.headers.get('x-session-expired') === '1') {
      onSessionExpired?.();
      throw new SessionExpiredError();
    }
    const message = json && 'error' in json ? formatMessage(json.error.message) : 'Une erreur est survenue.';
    throw new ApiError(message, response.status, json && 'error' in json ? json.error.path : undefined);
  }

  return json.data;
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'PUT', body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'DELETE' }),
};
