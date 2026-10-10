// backend/src/tickets/pdf-documents.spec.ts
// Génération réelle des PDF (pdfkit + codes-barres) : format A5, une page par colis, pas de plantage sur des textes difficiles.
import { renderBookingTicket, type BookingTicketData } from './booking-ticket.pdf';
import { renderParcelLabels, type ParcelLabelData } from './parcel-label.pdf';
import { pdfSafe } from './pdf-text';

const ticket: BookingTicketData = {
  reference: 'OCZ-7F3A91C2',
  qrPayload: 'OCCAZ1:B:7f3a91c2-1111-4222-8333-444455556666:abcdefghijklmnop',
  timeZone: 'Africa/Conakry',
  departureAt: new Date('2026-10-12T08:30:00Z'),
  boardingTimeKnown: true,
  originCity: 'Conakry',
  originPlace: 'Gare routière de Madina',
  destinationCity: 'Kindia',
  destinationPlace: null,
  arrivalAt: null,
  passengers: ['Boubacar BARRY', 'Fatou BARRY'],
  seatsCount: 2,
  driverName: 'Mamadou DIALLO',
  vehicle: 'Toyota Hiace blanc · AB-1234-GN',
  amountPaid: '235 000 GNF',
  bookedAt: new Date('2026-10-09T14:00:00Z'),
};

const label = (n: number, extra: Partial<ParcelLabelData> = {}): ParcelLabelData => ({
  trackingNumber: `OCZB0C1D2E3F4-0${n}`,
  displayTracking: 'OCZ B0C1 D2E3 F4',
  parcelNumber: n,
  parcelCount: 3,
  qrPayload: `OCCAZ1:P:b0c1d2e3-f4a5-4678-8901-23456789abcd.${n}:abcdefghijklmnop`,
  isUrgent: false,
  senderName: 'Boubacar BARRY',
  senderPlace: 'Kindia, Guinée',
  recipientName: 'Aïssatou Bah',
  recipientPhone: '+224620000002',
  recipientAddress: 'Quartier Wondima, Labé',
  recipientCity: 'Labé',
  recipientCountry: 'Guinée',
  weightKg: 3,
  dimensions: '40 × 30 × 20',
  declaredValue: null,
  description: null,
  category: 'Colis',
  windowEnd: new Date('2026-10-15T18:00:00Z'),
  timeZone: 'Africa/Conakry',
  ...extra,
});

/** Nombre de pages et format de la première page, lus dans le PDF lui-même. */
function inspect(pdf: Buffer) {
  const text = pdf.toString('latin1');
  const pages = (text.match(/\/Type \/Page\b/g) ?? []).length;
  const box = /\/MediaBox \[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/.exec(text);
  return { pages, width: box ? Number(box[1]) : NaN, height: box ? Number(box[2]) : NaN, isPdf: text.startsWith('%PDF-') };
}

describe('renderBookingTicket', () => {
  it('produit un PDF A5 d\'une page', async () => {
    const info = inspect(await renderBookingTicket(ticket));
    expect(info.isPdf).toBe(true);
    expect(info.pages).toBe(1);
    expect(info.width).toBeCloseTo(419.53, 1);
    expect(info.height).toBeCloseTo(595.28, 1);
  });

  it('supporte les textes très longs et les caractères hors de la police sans planter', async () => {
    const pdf = await renderBookingTicket({
      ...ticket,
      passengers: Array.from({ length: 6 }, (_, i) => `Passager ${i + 1} Ɓaldé-Ɗiallo avec un nom particulièrement long`),
      originPlace: 'Une adresse extrêmement longue '.repeat(10),
      driverName: 'Mamadou Ɗiallo '.repeat(8),
      vehicle: null,
      amountPaid: '1 235 000 GNF',
    });
    expect(inspect(pdf).pages).toBe(1);
  });
});

describe('renderParcelLabels', () => {
  it('produit une page A5 par colis', async () => {
    const info = inspect(await renderParcelLabels({ title: 'Étiquettes', labels: [label(1), label(2), label(3)] }));
    expect(info.pages).toBe(3);
    expect(info.width).toBeCloseTo(419.53, 1);
    expect(info.height).toBeCloseTo(595.28, 1);
  });

  it('supporte un colis sans mesures, urgent, avec un destinataire à nom et adresse très longs', async () => {
    const pdf = await renderParcelLabels({
      title: 'Étiquettes',
      labels: [
        label(1, {
          isUrgent: true,
          weightKg: null,
          dimensions: null,
          recipientName: 'Mamadou Saliou Ɗiallo Bah-Barry de la famille élargie',
          recipientAddress: 'Une adresse de livraison vraiment très longue avec beaucoup de détails sur le quartier, la rue et le repère. '.repeat(3),
          recipientCity: 'Sangaredi-Boké-Centre-Ville',
          recipientPhone: null,
          description: 'Contenu très détaillé '.repeat(12),
        }),
      ],
    });
    expect(inspect(pdf).pages).toBe(1);
  });
});

describe('pdfSafe', () => {
  it('garde les accents du français et remplace ce que la police ne connaît pas', () => {
    expect(pdfSafe('Aïssatou Bah — Thiès’ œuvre €')).toBe('Aïssatou Bah — Thiès’ œuvre €');
    expect(pdfSafe('Ɓaldé Ɗiallo')).toBe('?aldé ?iallo');
  });

  it('transforme les espaces fines des nombres français en espaces normales', () => {
    expect(pdfSafe('235 000 GNF')).toBe('235 000 GNF');
    expect(pdfSafe(new Intl.NumberFormat('fr-FR').format(235000))).not.toContain('?');
  });

  it('accepte null et undefined', () => {
    expect(pdfSafe(null)).toBe('');
    expect(pdfSafe(undefined)).toBe('');
  });
});
