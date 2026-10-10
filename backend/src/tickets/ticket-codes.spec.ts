// backend/src/tickets/ticket-codes.spec.ts
import {
  bookingQrPayload,
  bookingReference,
  createDownloadToken,
  DOWNLOAD_LINK_TTL_MS,
  formatTrackingNumber,
  parcelQrPayload,
  parcelTrackingNumber,
  readDownloadToken,
  shipmentTrackingNumber,
  verifyCode,
} from './ticket-codes';

const BOOKING_ID = '7f3a91c2-1111-4222-8333-444455556666';
const SHIPMENT_ID = 'b0c1d2e3-f4a5-4678-8901-23456789abcd';

describe('références', () => {
  it('référence de billet courte et lisible', () => {
    expect(bookingReference(BOOKING_ID)).toBe('OCZ-7F3A91C2');
  });

  it('numéro de suivi de l\'envoi, puis de chaque colis', () => {
    expect(shipmentTrackingNumber(SHIPMENT_ID)).toBe('OCZB0C1D2E3F4');
    expect(parcelTrackingNumber(SHIPMENT_ID, 1)).toBe('OCZB0C1D2E3F4-01');
    expect(parcelTrackingNumber(SHIPMENT_ID, 12)).toBe('OCZB0C1D2E3F4-12');
  });

  it('numéro de suivi mis en forme par groupes de quatre', () => {
    expect(formatTrackingNumber('OCZB0C1D2E3F4')).toBe('OCZ B0C1 D2E3 F4');
  });
});

describe('contenu signé des QR codes', () => {
  it('un QR de billet se relit et renvoie la réservation', () => {
    expect(verifyCode(bookingQrPayload(BOOKING_ID))).toEqual({ kind: 'BOOKING', bookingId: BOOKING_ID });
  });

  it('un QR d\'étiquette se relit et renvoie l\'envoi et le numéro du colis', () => {
    expect(verifyCode(parcelQrPayload(SHIPMENT_ID, 3))).toEqual({ kind: 'PARCEL', shipmentId: SHIPMENT_ID, parcelNumber: 3 });
  });

  it('un code modifié à la main est rejeté', () => {
    const payload = bookingQrPayload(BOOKING_ID);
    expect(verifyCode(payload.replace(BOOKING_ID, '00000000-1111-4222-8333-444455556666'))).toBeNull();
    expect(verifyCode(parcelQrPayload(SHIPMENT_ID, 1).replace('.1:', '.2:'))).toBeNull();
  });

  it('un code mal formé ou d\'une autre version est rejeté', () => {
    expect(verifyCode('')).toBeNull();
    expect(verifyCode('n-importe-quoi')).toBeNull();
    expect(verifyCode(bookingQrPayload(BOOKING_ID).replace('OCCAZ1', 'OCCAZ9'))).toBeNull();
  });

  it('ne laisse apparaître aucun code à usage unique ni donnée personnelle', () => {
    expect(bookingQrPayload(BOOKING_ID)).toMatch(/^OCCAZ1:B:[0-9a-f-]{36}:[A-Za-z0-9_-]{16}$/);
  });
});

describe('liens de téléchargement', () => {
  const now = Date.UTC(2026, 9, 10, 12, 0, 0);

  it('un jeton valide renvoie le document visé', () => {
    const { token } = createDownloadToken('BOOKING', BOOKING_ID, now);
    expect(readDownloadToken(token, now + 1000)).toEqual({ kind: 'BOOKING', id: BOOKING_ID });
    expect(readDownloadToken(createDownloadToken('SHIPMENT', SHIPMENT_ID, now).token, now)).toEqual({ kind: 'SHIPMENT', id: SHIPMENT_ID });
  });

  it('expire au bout de 10 minutes', () => {
    const { token, expiresAt } = createDownloadToken('BOOKING', BOOKING_ID, now);
    expect(expiresAt.getTime()).toBe(now + DOWNLOAD_LINK_TTL_MS);
    expect(readDownloadToken(token, now + DOWNLOAD_LINK_TTL_MS - 1)).not.toBeNull();
    expect(readDownloadToken(token, now + DOWNLOAD_LINK_TTL_MS + 1)).toBeNull();
  });

  it('un jeton modifié (autre document, autre date) est rejeté', () => {
    const { token } = createDownloadToken('BOOKING', BOOKING_ID, now);
    const [, signature] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ k: 'B', i: 'autre-reservation', e: now + 999_999_999 })).toString('base64url');
    expect(readDownloadToken(`${forged}.${signature}`, now)).toBeNull();
    expect(readDownloadToken('abc', now)).toBeNull();
    expect(readDownloadToken('a.b.c', now)).toBeNull();
  });
});
