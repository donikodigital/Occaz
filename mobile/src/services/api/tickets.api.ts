// mobile/src/services/api/tickets.api.ts
// [11/10/2026] v2 — scan(code) : contrôle d'un billet ou d'une étiquette par le conducteur.
// [10/10/2026] v1 — liens de téléchargement du billet (réservation) et des étiquettes (envoi), en PDF A5.
import { api } from './client';
import type { TicketScanResult } from '@/types/safety.types';

export interface PdfDownloadLink {
  /** Chemin relatif à l'API — à passer à apiUrl() pour obtenir l'adresse complète. */
  path: string;
  filename: string;
  expiresAt: string;
}

export const ticketsApi = {
  /** Billet PDF d'une réservation payée. */
  bookingLink: (bookingId: string) => api.get<PdfDownloadLink>(`/tickets/bookings/${bookingId}/link`),

  /** Étiquettes PDF d'un envoi payé : une page par colis. */
  shipmentLink: (shipmentId: string) => api.get<PdfDownloadLink>(`/tickets/shipments/${shipmentId}/link`),

  /** Le conducteur scanne le QR code d'un billet ou d'une étiquette : authentique, et concerne-t-il l'un de ses trajets / envois ? */
  scan: (code: string) => api.post<TicketScanResult>('/tickets/scan', { code }),
};
