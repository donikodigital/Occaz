// backend/src/tickets/pdf-documents.language.spec.ts
// Le billet et les étiquettes se génèrent dans les trois langues : même mise en page, textes traduits, aucun plantage sur les accents.
import { runWithLanguage } from '../i18n/language-context';
import { renderBookingTicket, type BookingTicketData } from './booking-ticket.pdf';
import { renderParcelLabels, type ParcelLabelData } from './parcel-label.pdf';

const ticket: BookingTicketData = {
  reference: 'OCZ-7F3A91C2',
  qrPayload: 'OCCAZ1:B:7f3a91c2-1111-4222-8333-444455556666:abcdefghijklmnop',
  timeZone: 'Africa/Conakry',
  departureAt: new Date('2026-10-12T08:30:00Z'),
  boardingTimeKnown: false,
  originCity: 'Conakry',
  originPlace: null,
  destinationCity: 'Kindia',
  destinationPlace: null,
  arrivalAt: null,
  passengers: ['Boubacar BARRY'],
  seatsCount: 1,
  driverName: 'Mamadou DIALLO',
  vehicle: null,
  amountPaid: '235 000 GNF',
  bookedAt: new Date('2026-10-09T14:00:00Z'),
};

const label: ParcelLabelData = {
  trackingNumber: 'OCZB0C1D2E3F4-01',
  displayTracking: 'OCZ B0C1 D2E3 F4',
  parcelNumber: 1,
  parcelCount: 1,
  qrPayload: 'OCCAZ1:P:b0c1d2e3-f4a5-4678-8901-23456789abcd.1:abcdefghijklmnop',
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
  declaredValue: '100 000 GNF',
  description: 'Documents',
  category: 'Colis',
  windowEnd: new Date('2026-10-15T18:00:00Z'),
  timeZone: 'Africa/Conakry',
};

const pages = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length;

describe('PDF dans la langue de la personne', () => {
  it.each(['fr', 'en-GB', 'pt-PT'])('billet en « %s » : un PDF A4 d\'une page', async (language) => {
    const pdf = await runWithLanguage(language, () => renderBookingTicket(ticket));
    expect(pdf.toString('latin1').startsWith('%PDF-')).toBe(true);
    expect(pages(pdf)).toBe(1);
  });

  it.each(['fr', 'en-GB', 'pt-PT'])('étiquette en « %s » : un PDF d\'une page par colis', async (language) => {
    const pdf = await runWithLanguage(language, () => renderParcelLabels({ title: 'Étiquettes OCZB0C1D2E3F4', labels: [label, { ...label, parcelNumber: 2 }] }));
    expect(pdf.toString('latin1').startsWith('%PDF-')).toBe(true);
    expect(pages(pdf)).toBe(2);
  });
});
