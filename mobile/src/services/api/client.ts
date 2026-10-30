// mobile/src/services/api/client.ts
// [30/10/2026] v+ — chaque requête envoie la langue choisie (en-tête X-App-Language) : le serveur répond dans cette langue ;
// les liens ouverts dans le navigateur (apiUrl) la portent dans l'adresse (?lang=).
// [25/10/2026] v++ — réseau faible : un rafraîchissement qui échoue faute de réseau (ou à cause d'une erreur serveur passagère) ne déconnecte plus
// et ne supprime plus les jetons ; seul un refus définitif du serveur (jeton refusé, expiré ou révoqué) met fin à la session.
// [19/10/2026] v+ — alimente connectivityStore : échec réseau (hors délai dépassé) => hors connexion ; toute réponse du serveur => en ligne.
import Constants from 'expo-constants';
import { secureStorage } from '../storage/secureStorage';
import { ApiError, SessionExpiredError } from './ApiError';
import { useConnectivityStore } from '@/stores/connectivityStore';
import { translate, useLanguageStore } from '@/i18n';
import type { ApiErrorEnvelope, ApiSuccessEnvelope } from './types';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  'http://localhost:3000/api/v1';

/**
 * Délai maximal d'une requête. `fetch` n'en a aucun par défaut dans React Native : si le serveur ne répond pas (démarrage à
 * froid de l'hébergeur, réseau mobile instable), l'appel restait en attente indéfiniment — et l'app avec lui, bloquée sur l'écran
 * de démarrage tant que la vérification de session (authStore.hydrate) n'était pas terminée.
 */
const REQUEST_TIMEOUT_MS = 30_000;

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

/** Adresse complète d'un chemin de l'API — pour ouvrir un lien (PDF) dans le navigateur ou la visionneuse du téléphone. */
export function apiUrl(path: string, query?: RequestOptions['query']): string {
  // Un lien ouvert dans le navigateur n'envoie pas l'en-tête de langue : elle voyage dans l'adresse (billet PDF dans la bonne langue).
  return buildUrl(path, { lang: useLanguageStore.getState().language, ...query });
}

async function rawFetch<T>(path: string, options: RequestOptions, accessToken?: string | null): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    let response: Response;
    try {
      response = await fetch(buildUrl(path, options.query), {
        method: options.method ?? 'GET',
        headers: {
          'Content-Type': 'application/json',
          // Langue de l'app : le serveur y traduit ses messages d'erreur (et le SMS du code de connexion, avant même d'être connecté).
          'X-App-Language': useLanguageStore.getState().language,
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
    } catch {
      // Un délai dépassé (abandon volontaire) ne prouve pas que le réseau est coupé ; un échec immédiat, si.
      if (!controller.signal.aborted) useConnectivityStore.getState().markOffline();
      throw new ApiError(
        controller.signal.aborted
          ? translate('Le serveur met trop de temps à répondre — réessayez dans un instant.')
          : translate('Connexion impossible — vérifiez votre réseau.'),
        0,
      );
    }

    useConnectivityStore.getState().markOnline();
    const json = (await response.json().catch(() => null)) as
      | ApiSuccessEnvelope<T>
      | ApiErrorEnvelope
      | null;

    if (!response.ok || !json || json.success === false) {
      const message = json && 'error' in json ? formatMessage(json.error.message) : translate('Une erreur est survenue.');
      throw new ApiError(message, response.status, json && 'error' in json ? json.error.path : undefined);
    }

    return json.data;
  } finally {
    clearTimeout(timer);
  }
}

function formatMessage(message: string | string[]): string {
  return Array.isArray(message) ? message.join(' ') : message;
}

/** Statuts par lesquels le serveur refuse définitivement le jeton de rafraîchissement : la session est réellement terminée. */
const DEFINITIVE_REFRESH_REFUSAL = new Set([400, 401, 403]);

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
  } catch (error) {
    // Refus définitif du serveur : seulement dans ce cas on efface les jetons et on déconnecte.
    if (error instanceof ApiError && DEFINITIVE_REFRESH_REFUSAL.has(error.statusCode)) {
      await secureStorage.clearTokens();
      throw new SessionExpiredError();
    }
    // Tout le reste (réseau coupé, délai dépassé, 5xx, 429) est passager : les jetons sont conservés, la requête échoue
    // proprement et l'utilisateur réessaie — il ne perd pas sa session parce qu'il passe dans un tunnel.
    throw error instanceof ApiError ? error : new ApiError(translate('Connexion impossible — vérifiez votre réseau.'), 0);
  }
}

/**
 * Point d'entrée unique pour tout appel réseau de l'application. Ajoute
 * le jeton d'accès, retente une fois après un rafraîchissement réussi
 * en cas de 401, et propage une SessionExpiredError seulement quand la
 * session est réellement perdue (jamais un état d'erreur silencieux).
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const useAuth = options.auth !== false;
  const accessToken = useAuth ? await secureStorage.getAccessToken() : null;

  try {
    return await rawFetch<T>(path, options, accessToken);
  } catch (error) {
    if (!(error instanceof ApiError) || !error.isAuthError || !useAuth) throw error;

    let newAccessToken: string;
    try {
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
      newAccessToken = await refreshPromise;
    } catch (refreshError) {
      if (refreshError instanceof SessionExpiredError) onSessionExpired?.();
      throw refreshError instanceof ApiError ? refreshError : new ApiError(translate('Connexion impossible — vérifiez votre réseau.'), 0);
    }

    try {
      return await rawFetch<T>(path, options, newAccessToken);
    } catch (retryError) {
      // Jeton fraîchement obtenu et toujours refusé : la session n'est plus valable.
      if (retryError instanceof ApiError && retryError.isAuthError) {
        onSessionExpired?.();
        throw new SessionExpiredError();
      }
      throw retryError;
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