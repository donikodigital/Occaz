// web-admin/src/app/api/bff/[...path]/route.ts
// [19/10/2026] v1 — Relais entre le navigateur et l'API Occa'Z, qui garde les jetons de connexion HORS de portée de JavaScript.
//
//   navigateur ──(cookies HttpOnly)──▶ /api/bff/<chemin> ──(Authorization: Bearer)──▶ API /api/v1/<chemin>
//
//  • Les jetons ne sont jamais écrits dans la page : à la connexion, le relais lit accessToken/refreshToken dans la réponse de l'API, les
//    pose en cookies HttpOnly et les RETIRE du corps renvoyé au navigateur.
//  • L'ajout du jeton à chaque appel et le renouvellement (refresh) se font ici, côté serveur. Les appels simultanés qui arrivent avec le
//    même refresh token partagent UN SEUL renouvellement (l'API fait tourner les refresh tokens : un second appel invaliderait le premier).
//  • Protection CSRF : tout appel qui modifie des données doit porter un en-tête Origin identique à ce site ; en plus, les cookies sont
//    SameSite=Strict.
//  • Chemins : segments simples seulement (pas de « .. »), et /auth/refresh n'est pas exposé.
import { NextResponse } from 'next/server';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearedSessionCookies,
  isSameOrigin,
  isSecureRequest,
  readCookie,
  sessionCookies,
} from '@/lib/server/session-cookies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_URL = (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1').replace(/\/+$/, '');
const UPSTREAM_TIMEOUT_MS = 60_000;
const SAFE_SEGMENT = /^[A-Za-z0-9._~%-]+$/;
const FORWARDED_REQUEST_HEADERS = ['content-type', 'accept', 'accept-language', 'user-agent', 'x-forwarded-for'] as const;
const FORWARDED_RESPONSE_HEADERS = ['content-type', 'content-disposition', 'content-language'] as const;

interface Tokens {
  accessToken: string;
  refreshToken: string;
}
type RefreshOutcome = { ok: true; tokens: Tokens } | { ok: false; definitive: boolean };

// --- Renouvellement partagé -----------------------------------------------------------------------------------------------------------

const refreshes = new Map<string, Promise<RefreshOutcome>>();
const REFRESH_SHARE_MS = 15_000;

async function requestRefresh(refreshToken: string): Promise<RefreshOutcome> {
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (response.status === 401 || response.status === 403) return { ok: false, definitive: true };
    if (!response.ok) return { ok: false, definitive: false };
    const json = (await response.json().catch(() => null)) as { data?: Partial<Tokens> } | null;
    const tokens = json?.data;
    if (typeof tokens?.accessToken === 'string' && typeof tokens.refreshToken === 'string') {
      return { ok: true, tokens: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken } };
    }
    return { ok: false, definitive: false };
  } catch {
    return { ok: false, definitive: false };
  }
}

function refreshOnce(refreshToken: string): Promise<RefreshOutcome> {
  const running = refreshes.get(refreshToken);
  if (running) return running;
  const promise = requestRefresh(refreshToken);
  refreshes.set(refreshToken, promise);
  setTimeout(() => refreshes.delete(refreshToken), REFRESH_SHARE_MS).unref?.();
  return promise;
}

// --- Aides --------------------------------------------------------------------------------------------------------------------------------

function errorResponse(status: number, message: string, path: string, extraHeaders: Record<string, string> = {}): NextResponse {
  return NextResponse.json(
    { success: false, error: { statusCode: status, message, path, timestamp: new Date().toISOString() } },
    { status, headers: { 'cache-control': 'no-store', ...extraHeaders } },
  );
}

function upstreamUrl(segments: string[], search: string): string | null {
  if (segments.length === 0) return null;
  for (const segment of segments) {
    if (!SAFE_SEGMENT.test(segment)) return null;
    let decoded: string;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      return null;
    }
    if (decoded === '.' || decoded === '..' || decoded.includes('/') || decoded.includes('\\')) return null;
  }
  if (segments.join('/').toLowerCase() === 'auth/refresh') return null; // le renouvellement n'est jamais piloté par le navigateur
  return `${API_URL}/${segments.join('/')}${search}`;
}

async function callApi(url: string, method: string, request: Request, body: ArrayBuffer | undefined, accessToken?: string): Promise<Response> {
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);
  return fetch(url, { method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
}

/** Si la réponse de l'API transporte une paire de jetons (connexion), les retire du corps et les renvoie à part. */
async function extractTokens(upstream: Response): Promise<{ body: BodyInit | null; tokens: Tokens | null }> {
  const type = upstream.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) return { body: upstream.body, tokens: null };

  const text = await upstream.text();
  try {
    const json = JSON.parse(text) as { success?: boolean; data?: Record<string, unknown> };
    const data = json?.data;
    if (json?.success === true && data && typeof data === 'object' && typeof data.accessToken === 'string' && typeof data.refreshToken === 'string') {
      const tokens = { accessToken: data.accessToken, refreshToken: data.refreshToken };
      delete data.accessToken;
      delete data.refreshToken;
      return { body: JSON.stringify(json), tokens };
    }
  } catch {
    // corps non JSON : transmis tel quel
  }
  return { body: text, tokens: null };
}

// --- Gestionnaire --------------------------------------------------------------------------------------------------------------------

async function handle(request: Request, context: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await context.params;
  const requestUrl = new URL(request.url);
  const url = upstreamUrl(path ?? [], requestUrl.search);
  const displayPath = `/api/bff/${(path ?? []).join('/')}`;
  if (!url) return errorResponse(404, 'Route introuvable.', displayPath);

  const method = request.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD' && !isSameOrigin(request.headers)) {
    return errorResponse(403, 'Requête refusée : origine inconnue.', displayPath);
  }

  const secure = isSecureRequest(request.headers, request.url);
  const cookieHeader = request.headers.get('cookie');
  let accessToken = readCookie(cookieHeader, ACCESS_COOKIE);
  let refreshToken = readCookie(cookieHeader, REFRESH_COOKIE);
  const hadSession = Boolean(accessToken || refreshToken);
  const setCookies: string[] = [];
  const isLogout = path.join('/').toLowerCase() === 'auth/logout';

  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer();

  // Jeton d'accès expiré (le cookie a disparu) mais refresh token encore là : on renouvelle avant l'appel.
  let sessionLost = false;
  async function renew(): Promise<boolean> {
    if (!refreshToken) return false;
    const outcome = await refreshOnce(refreshToken);
    if (outcome.ok) {
      accessToken = outcome.tokens.accessToken;
      refreshToken = outcome.tokens.refreshToken;
      setCookies.splice(0, setCookies.length, ...sessionCookies(outcome.tokens, secure));
      return true;
    }
    if (outcome.definitive) {
      sessionLost = true;
      setCookies.splice(0, setCookies.length, ...clearedSessionCookies(secure));
    }
    return false;
  }

  if (!accessToken && refreshToken) await renew();

  let upstream: Response;
  try {
    upstream = await callApi(url, method, request, body, accessToken);
    if (upstream.status === 401 && refreshToken && !isLogout) {
      if (await renew()) upstream = await callApi(url, method, request, body, accessToken);
    }
  } catch {
    return errorResponse(503, "Le serveur Occa'Z ne répond pas. Réessayez dans un instant.", displayPath);
  }

  const headers = new Headers({ 'cache-control': 'no-store' });
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  const { body: responseBody, tokens } = await extractTokens(upstream);
  if (tokens) {
    setCookies.splice(0, setCookies.length, ...sessionCookies(tokens, secure));
  } else if (isLogout) {
    setCookies.splice(0, setCookies.length, ...clearedSessionCookies(secure));
  }

  // Dit au navigateur que la SESSION (et non seulement cette requête) est perdue : il retourne à l'écran de connexion. Un 401 « métier »
  // (code 2FA incorrect, par exemple) ne contient pas cet en-tête et n'expulse personne.
  if (upstream.status === 401 && !tokens && !isLogout && (sessionLost || !hadSession || !refreshToken)) {
    headers.set('x-session-expired', '1');
  }
  for (const cookie of setCookies) headers.append('set-cookie', cookie);

  const status = upstream.status >= 300 && upstream.status < 400 ? 502 : upstream.status;
  return new Response(method === 'HEAD' || status === 204 || status === 304 ? null : responseBody, { status, headers });
}

export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE, handle as HEAD };
