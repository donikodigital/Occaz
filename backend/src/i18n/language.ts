// backend/src/i18n/language.ts
// [30/10/2026] v1 — Langues de la plateforme : français (par défaut), anglais (Royaume-Uni), portugais (Portugal).
//
// La langue d'une personne est celle qu'elle a choisie dans l'application : mémorisée sur son compte (User.language) pour les
// textes envoyés hors d'une requête (notifications, SMS, e-mails), et envoyée par l'application à chaque requête dans l'en-tête
// `X-App-Language` pour les réponses (messages d'erreur, billet PDF) — y compris avant la connexion (code de connexion par SMS).
// Le back-office web n'envoie pas cet en-tête : il reste en français.
import type { Request } from 'express';

export const APP_LANGUAGES = ['fr', 'en-GB', 'pt-PT'] as const;
export type AppLanguage = (typeof APP_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: AppLanguage = 'fr';
export const LANGUAGE_HEADER = 'x-app-language';

/** Reconnaît une langue écrite par l'application ou par un autre client (« en », « en-US », « pt_BR »…). Null si inconnue. */
export function parseLanguage(value: unknown): AppLanguage | null {
  if (typeof value !== 'string') return null;
  const code = value.trim().replace('_', '-').toLowerCase().split(',')[0].split(';')[0];
  if (code === 'fr' || code.startsWith('fr-')) return 'fr';
  if (code === 'en' || code.startsWith('en-')) return 'en-GB';
  if (code === 'pt' || code.startsWith('pt-')) return 'pt-PT';
  return null;
}

/**
 * Langue à utiliser pour répondre à une requête : le paramètre `?lang=` (lien ouvert dans un navigateur, comme un billet PDF), sinon l'en-tête
 * de l'application, sinon la langue du compte connecté, sinon le français. Accept-Language n'est pas lu exprès : le navigateur du
 * back-office (en français) ne doit pas basculer en anglais parce que le poste de la personne est réglé ainsi.
 */
export function languageFromRequest(
  request: Pick<Request, 'headers'> & { query?: Record<string, unknown>; user?: { language?: string | null } },
): AppLanguage {
  const header = request.headers?.[LANGUAGE_HEADER];
  return (
    parseLanguage(request.query?.lang) ??
    parseLanguage(Array.isArray(header) ? header[0] : header) ??
    parseLanguage(request.user?.language) ??
    DEFAULT_LANGUAGE
  );
}
