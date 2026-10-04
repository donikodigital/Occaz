// backend/src/trips/booking-contacts.ts
//
// Une fois le trajet terminé (réservation COMPLETED : le client est déposé, la dépose validée), le conducteur et le client ne se
// communiquent plus leurs numéros — comme pour un colis livré (voir shipments/shipment-views.ts). En cas de problème, le recours
// est « Signaler un problème », traité par le support, qui garde tous les numéros.
//
// À appliquer UNIQUEMENT aux vues du client et du conducteur de la réservation : le support (back-office) voit toujours tout.
export type BookingViewer = 'customer' | 'driver';

/** Statuts où la prestation est terminée : plus d'appel, de SMS ni de nouveau message entre les deux parties. */
export const BOOKING_CONTACT_CLOSED_STATUSES: ReadonlySet<string> = new Set(['COMPLETED']);

export function hideContactsOnceCompleted<
  T extends { status: string; driverPhone: string | null; customerPhone: string | null },
>(booking: T, viewer: BookingViewer): T {
  if (!BOOKING_CONTACT_CLOSED_STATUSES.has(booking.status)) return booking;
  return viewer === 'driver' ? { ...booking, customerPhone: null } : { ...booking, driverPhone: null };
}
