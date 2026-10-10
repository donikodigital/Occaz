// mobile/src/utils/tracking.ts
// [10/10/2026] v1 — numéro de suivi d'un envoi, lien à partager et lecture d'un numéro saisi.

/** « 7f3a91c2-… » → « OCZ7F3A91C2B0 » : même règle que le serveur (voir backend/src/tickets/ticket-codes.ts). */
export function trackingNumberOf(shipmentId: string): string {
  return `OCZ${shipmentId.replace(/-/g, '').slice(0, 10).toUpperCase()}`;
}

/** « OCZ7F3A91C2B0 » → « OCZ 7F3A 91C2 B0 » : plus facile à lire et à recopier. */
export function formatTrackingNumber(trackingNumber: string): string {
  const body = trackingNumber.replace(/^OCZ/, '');
  return `OCZ ${body.match(/.{1,4}/g)?.join(' ') ?? body}`;
}

/**
 * Accepte ce qu'une personne recopie ou colle : « ocz 7f3a 91c2 b0 », « OCZ7F3A91C2B0-02 » (numéro d'un colis, ramené à celui de
 * l'envoi), voire un lien de suivi entier. Renvoie null si ce n'est pas un numéro Occa'Z.
 */
export function parseTrackingNumber(input: string): string | null {
  const text = input.trim().toUpperCase();
  const fromLink = text.match(/\/SUIVI\/([A-Z0-9 -]+)/);
  const compact = (fromLink ? fromLink[1] : text).replace(/\s+/g, '').replace(/-\d{1,3}$/, '').replace(/[^A-Z0-9]/g, '');
  return /^OCZ[0-9A-F]{10}$/.test(compact) ? compact : null;
}

/** Adresse publique de la page de suivi, si l'application web est configurée (EXPO_PUBLIC_TRACKING_BASE_URL). */
export function trackingLink(trackingNumber: string): string | null {
  const base = process.env.EXPO_PUBLIC_TRACKING_BASE_URL?.trim().replace(/\/+$/, '');
  return base ? `${base}/suivi/${trackingNumber}` : null;
}
