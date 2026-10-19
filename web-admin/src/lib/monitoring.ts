// web-admin/src/lib/monitoring.ts
// [19/10/2026] v1 — Suivi des erreurs du back-office (Sentry), SANS dépendance : un petit rapporteur qui envoie les erreurs non rattrapées
// de la page (window.onerror, promesses rejetées) et celles des écrans d'erreur à Sentry, par son API « envelope ». Sans
// NEXT_PUBLIC_SENTRY_DSN, rien n'est initialisé et rien n'est envoyé (comportement identique à l'application mobile).
//   NEXT_PUBLIC_SENTRY_DSN          https://<clé>@oXXXX.ingest.sentry.io/<projet>
//   NEXT_PUBLIC_SENTRY_ENVIRONMENT  production | staging … (par défaut : NODE_ENV)
//   NEXT_PUBLIC_SENTRY_RELEASE      version publiée (facultatif)
// Limites assumées : pas de source maps ni de « breadcrumbs » (le SDK complet @sentry/nextjs peut les ajouter plus tard, sans changer les
// appels). Respect de la vie privée : jamais de corps de requête, de cookie ni de chaîne de requête de l'adresse — seulement le chemin.
'use client';

interface ParsedDsn {
  endpoint: string;
  key: string;
}

const MAX_EVENTS_PER_PAGE = 20;
const DEDUPE_WINDOW_MS = 30_000;

let dsn: ParsedDsn | null | undefined;
let sent = 0;
const recent = new Map<string, number>();
let started = false;

/** Découpe « https://clé@hôte/projet » ; renvoie null si le DSN est absent ou mal formé. */
export function parseDsn(raw: string | undefined): ParsedDsn | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    const projectId = url.pathname.replace(/^\/+/, '').split('/').pop();
    if (!url.username || !projectId || !/^https?:$/.test(url.protocol)) return null;
    return { endpoint: `${url.protocol}//${url.host}/api/${projectId}/envelope/`, key: url.username };
  } catch {
    return null;
  }
}

function currentDsn(): ParsedDsn | null {
  if (dsn === undefined) dsn = parseDsn(process.env.NEXT_PUBLIC_SENTRY_DSN);
  return dsn;
}

/** Transforme une pile « at fonction (fichier:ligne:colonne) » en cadres lisibles par Sentry (le plus récent en dernier). */
export function parseStack(stack: string | undefined): Array<{ function?: string; filename?: string; lineno?: number; colno?: number }> {
  if (!stack) return [];
  const frames: Array<{ function?: string; filename?: string; lineno?: number; colno?: number }> = [];
  for (const line of stack.split('\n')) {
    const match = /^\s*at\s+(?:(.*?)\s+\()?(.*?):(\d+):(\d+)\)?\s*$/.exec(line) ?? /^\s*(.*?)@(.*?):(\d+):(\d+)\s*$/.exec(line);
    if (match) frames.push({ function: match[1] || '?', filename: match[2], lineno: Number(match[3]), colno: Number(match[4]) });
  }
  return frames.reverse();
}

function eventId(): string {
  return (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`).replace(/-/g, '').padEnd(32, '0').slice(0, 32);
}

/** Envoie une erreur à Sentry (meilleur effort : ne lève jamais d'exception, ne bloque jamais l'écran). */
export function captureException(error: unknown, context: Record<string, string | undefined> = {}): void {
  try {
    const target = currentDsn();
    if (!target || typeof window === 'undefined' || sent >= MAX_EVENTS_PER_PAGE) return;

    const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Erreur inconnue');
    const signature = `${err.name}:${err.message}`;
    const now = Date.now();
    if ((recent.get(signature) ?? 0) > now - DEDUPE_WINDOW_MS) return;
    recent.set(signature, now);
    sent += 1;

    const event = {
      event_id: eventId(),
      timestamp: now / 1000,
      platform: 'javascript',
      level: 'error',
      environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
      release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || undefined,
      tags: { app: 'web-admin', ...context },
      request: { url: `${window.location.origin}${window.location.pathname}`, headers: { 'User-Agent': navigator.userAgent } },
      exception: { values: [{ type: err.name, value: err.message, stacktrace: { frames: parseStack(err.stack) } }] },
    };
    const body = [
      JSON.stringify({ event_id: event.event_id, sent_at: new Date(now).toISOString() }),
      JSON.stringify({ type: 'event' }),
      JSON.stringify(event),
    ].join('\n');

    void fetch(`${target.endpoint}?sentry_version=7&sentry_key=${encodeURIComponent(target.key)}&sentry_client=occaz-web-admin%2F1`, {
      method: 'POST',
      body,
      keepalive: true,
      credentials: 'omit',
      mode: 'cors',
    }).catch(() => undefined);
  } catch {
    // le suivi ne doit jamais casser l'application
  }
}

/** Branche les erreurs non rattrapées de la page. À appeler une fois au chargement (Providers). */
export function initMonitoring(): void {
  if (started || typeof window === 'undefined' || !currentDsn()) return;
  started = true;
  window.addEventListener('error', (event) => captureException(event.error ?? event.message, { source: 'window.onerror' }));
  window.addEventListener('unhandledrejection', (event) => captureException(event.reason, { source: 'unhandledrejection' }));
}
