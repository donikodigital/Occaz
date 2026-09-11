// mobile/src/services/api/client.ts
import Constants from 'expo-constants';
import { secureStorage } from '../storage/secureStorage';
import { ApiError, SessionExpiredError } from './ApiError';
import type { ApiErrorEnvelope, ApiSuccessEnvelope } from './types';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  'http://localhost:3000/api/v1';

/**
 * Un seul rafraîchissement en vol à la fois — si plusieurs requêtes
 * échouent en 401 simultanément, elles attendent toutes la même
 * promesse au lieu de déclencher chacune leur propre appel à
 * /auth/refresh (qui invaliderait le refresh token des autres, section
 * Authentification, rotation des jetons — voir backend Lot 1).
 */
let refreshPromise: Promise<string> | null = null;

/** Déclenché uniquement quand le rafraîchissement échoue réellement — enregistré par le store d'auth au démarrage. */
let onSessionExpired: (() => void) | null = null;
export function registerSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** false pour les routes publiques (OTP, webhooks...) — n'essaie pas d'ajouter un jeton. */
  auth?: boolean;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(path.replace(/^\//, ''), `${API_URL}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function rawFetch<T>(path: string, options: RequestOptions, accessToken?: string | null): Promise<T> {
  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError('Connexion impossible — vérifiez votre réseau.', 0);
  }

  const json = (await response.json().catch(() => null)) as
    | ApiSuccessEnvelope<T>
    | ApiErrorEnvelope
    | null;

  if (!response.ok || !json || json.success === false) {
    const message = json && 'error' in json ? formatMessage(json.error.message) : 'Une erreur est survenue.';
    throw new ApiError(message, response.status, json && 'error' in json ? json.error.path : undefined);
  }

  return json.data;
}

function formatMessage(message: string | string[]): string {
  return Array.isArray(message) ? message.join(' ') : message;
}

async function refreshAccessToken(): Promise<string> {
  const refreshToken = await secureStorage.getRefreshToken();
  if (!refreshToken) throw new SessionExpiredError();

  try {
    const result = await rawFetch<{ accessToken: string; refreshToken: string }>(
      '/auth/refresh',
      { method: 'POST', body: { refreshToken } },
    );
    await secureStorage.setTokens(result.accessToken, result.refreshToken);
    return result.accessToken;
  } catch {
    await secureStorage.clearTokens();
    throw new SessionExpiredError();
  }
}

/**
 * Point d'entrée unique pour tout appel réseau de l'application. Ajoute
 * le jeton d'accès, retente une fois après un rafraîchissement réussi
 * en cas de 401, et propage une SessionExpiredError sinon (jamais un
 * état d'erreur silencieux).
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const useAuth = options.auth !== false;
  const accessToken = useAuth ? await secureStorage.getAccessToken() : null;

  try {
    return await rawFetch<T>(path, options, accessToken);
  } catch (error) {
    if (!(error instanceof ApiError) || !error.isAuthError || !useAuth) throw error;

    try {
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
      const newAccessToken = await refreshPromise;
      return await rawFetch<T>(path, options, newAccessToken);
    } catch (refreshError) {
      onSessionExpired?.();
      throw refreshError instanceof ApiError ? refreshError : new SessionExpiredError();
    }
  }
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
