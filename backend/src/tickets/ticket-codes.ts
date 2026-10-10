// backend/src/tickets/ticket-codes.ts
// [10/10/2026] v1 — numéros de référence lisibles et contenu signé des QR codes des billets et des étiquettes.
import { createHmac, timingSafeEqual } from 'crypto';

/** Préfixe de version du contenu des QR codes : permet de changer le format plus tard sans confondre d'anciens billets. */
const QR_PREFIX = 'OCCAZ1';

/** « 7f3a91c2-… » → « 7F3A91C2 » : court, sans ambiguïté à dicter par téléphone. */
function shortId(id: string, length: number): string {
  return id.replace(/-/g, '').slice(0, length).toUpperCase();
}

/** Référence du billet d'une réservation, ex. « OCZ-7F3A91C2 ». */
export function bookingReference(bookingId: string): string {
  return `OCZ-${shortId(bookingId, 8)}`;
}

/** Numéro de suivi d'un envoi, ex. « OCZ7F3A91C2B0 » (le suffixe -01, -02… désigne le colis). */
export function shipmentTrackingNumber(shipmentId: string): string {
  return `OCZ${shortId(shipmentId, 10)}`;
}

/** Numéro de suivi d'UN colis, ex. « OCZ7F3A91C2B0-02 » : celui du code-barres de son étiquette. */
export function parcelTrackingNumber(shipmentId: string, parcelNumber: number): string {
  return `${shipmentTrackingNumber(shipmentId)}-${String(parcelNumber).padStart(2, '0')}`;
}

/** « OCZ7F3A91C2B0 » → « OCZ 7F3A 91C2 B0 » : plus facile à lire et à recopier. */
export function formatTrackingNumber(tracking: string): string {
  const body = tracking.replace(/^OCZ/, '');
  return `OCZ ${body.match(/.{1,4}/g)?.join(' ') ?? body}`;
}

/**
 * Secret de signature des QR codes. TICKET_SIGNING_SECRET si défini, sinon le secret des jetons d'accès. Hors production, une valeur de
 * développement évite de bloquer ; en production, son absence est une erreur claire plutôt qu'une signature sans valeur.
 */
function signingSecret(): string {
  const secret = process.env.TICKET_SIGNING_SECRET || process.env.JWT_ACCESS_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error("Variable d'environnement TICKET_SIGNING_SECRET manquante (ou JWT_ACCESS_SECRET) — voir .env.example.");
  }
  return 'occaz-dev-ticket-secret';
}

function sign(payload: string): string {
  return createHmac('sha256', signingSecret()).update(payload).digest('base64url').slice(0, 16);
}

/** Contenu du QR code d'un billet : « OCCAZ1:B:<réservation>:<signature> ». */
export function bookingQrPayload(bookingId: string): string {
  const body = `B:${bookingId}`;
  return `${QR_PREFIX}:${body}:${sign(body)}`;
}

/** Contenu du QR code d'une étiquette : « OCCAZ1:P:<envoi>.<n° du colis>:<signature> ». */
export function parcelQrPayload(shipmentId: string, parcelNumber: number): string {
  const body = `P:${shipmentId}.${parcelNumber}`;
  return `${QR_PREFIX}:${body}:${sign(body)}`;
}

export type VerifiedCode =
  | { kind: 'BOOKING'; bookingId: string }
  | { kind: 'PARCEL'; shipmentId: string; parcelNumber: number };

/**
 * Lit un QR code et vérifie sa signature : un code modifié ou fabriqué à la main est rejeté (null). Sert à toute future lecture du
 * code (application du conducteur, contrôle) sans avoir à interroger la base pour savoir si le code est authentique.
 */
export function verifyCode(code: string): VerifiedCode | null {
  const parts = code.trim().split(':');
  if (parts.length !== 4 || parts[0] !== QR_PREFIX) return null;
  const [, kind, value, signature] = parts;
  const expected = sign(`${kind}:${value}`);
  const given = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return null;

  if (kind === 'B') return { kind: 'BOOKING', bookingId: value };
  if (kind === 'P') {
    const [shipmentId, number] = value.split('.');
    const parcelNumber = Number(number);
    if (!shipmentId || !Number.isInteger(parcelNumber) || parcelNumber < 1) return null;
    return { kind: 'PARCEL', shipmentId, parcelNumber };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Liens de téléchargement à durée limitée
// ---------------------------------------------------------------------------

/** Durée de validité d'un lien de téléchargement : le temps d'ouvrir le PDF, pas plus. */
export const DOWNLOAD_LINK_TTL_MS = 10 * 60 * 1000;

export type DownloadKind = 'BOOKING' | 'SHIPMENT';

/**
 * Jeton d'un lien de téléchargement : « <contenu>.<signature> », où le contenu dit quel document (réservation ou envoi) et jusqu'à
 * quand. Le lien est demandé par une personne connectée (propriétaire du document, vérifié à ce moment-là) puis ouvert dans le
 * navigateur ou la visionneuse PDF du téléphone, qui n'a pas le jeton de connexion de l'application — comme un lien pré-signé.
 */
export function createDownloadToken(kind: DownloadKind, id: string, now: number = Date.now()): { token: string; expiresAt: Date } {
  const expiresAt = now + DOWNLOAD_LINK_TTL_MS;
  const body = Buffer.from(JSON.stringify({ k: kind === 'BOOKING' ? 'B' : 'S', i: id, e: expiresAt })).toString('base64url');
  return { token: `${body}.${sign(`D:${body}`)}`, expiresAt: new Date(expiresAt) };
}

/** Lit un jeton de téléchargement ; null s'il est modifié, mal formé ou expiré. */
export function readDownloadToken(token: string, now: number = Date.now()): { kind: DownloadKind; id: string } | null {
  const [body, signature, ...rest] = token.split('.');
  if (!body || !signature || rest.length > 0) return null;
  const expected = Buffer.from(sign(`D:${body}`));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { k?: string; i?: string; e?: number };
    if (typeof payload.i !== 'string' || typeof payload.e !== 'number' || payload.e < now) return null;
    if (payload.k === 'B') return { kind: 'BOOKING', id: payload.i };
    if (payload.k === 'S') return { kind: 'SHIPMENT', id: payload.i };
  } catch {
    return null;
  }
  return null;
}
