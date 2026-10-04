// backend/src/trips/booking-contacts.spec.ts
// Trajet terminé : plus de numéros entre le conducteur et le client ; le support garde tout (non concerné par cette fonction).
import { hideContactsOnceCompleted } from './booking-contacts';

const booking = (status: string) => ({
  id: 'b1', status, driverPhone: '+224620000003' as string | null, customerPhone: '+224620000002' as string | null,
});

describe('hideContactsOnceCompleted', () => {
  it('conducteur : plus le numéro du client une fois la réservation COMPLETED', () => {
    const view = hideContactsOnceCompleted(booking('COMPLETED'), 'driver');
    expect(view.customerPhone).toBeNull();
    expect(view.driverPhone).toBe('+224620000003'); // son propre numéro n'est pas concerné
    expect(view.id).toBe('b1');
  });

  it('client : plus le numéro du conducteur une fois la réservation COMPLETED', () => {
    const view = hideContactsOnceCompleted(booking('COMPLETED'), 'customer');
    expect(view.driverPhone).toBeNull();
    expect(view.customerPhone).toBe('+224620000002');
  });

  it.each(['CONFIRMED', 'PAID', 'PENDING_PAYMENT', 'CANCELLED', 'REFUNDED'])(
    'réservation %s : la vue est inchangée (la règle des numéros avant paiement reste celle de withContactPhones)',
    (status) => {
      expect(hideContactsOnceCompleted(booking(status), 'driver')).toEqual(booking(status));
      expect(hideContactsOnceCompleted(booking(status), 'customer')).toEqual(booking(status));
    },
  );

  it('ne modifie pas l\'objet d\'origine', () => {
    const original = booking('COMPLETED');
    hideContactsOnceCompleted(original, 'driver');
    expect(original.customerPhone).toBe('+224620000002');
  });
});
