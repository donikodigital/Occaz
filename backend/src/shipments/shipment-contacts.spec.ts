// backend/src/shipments/shipment-contacts.spec.ts
// Colis livré sans litige : plus de numéros de téléphone entre le chauffeur et les clients.
import { hideContactsOnceDelivered } from './shipment-views';

const shipment = (status: string) => ({
  id: 's1',
  status,
  senderPhone: '+221700000001',
  recipientPhone: '+224620000002',
  driverPhone: '+224620000003' as string | null,
});

describe('hideContactsOnceDelivered', () => {
  it.each(['DELIVERED', 'COMPLETED'])('chauffeur : plus les numéros de l\'expéditeur ni du destinataire (%s)', (status) => {
    const view = hideContactsOnceDelivered(shipment(status), 'driver');
    expect(view.senderPhone).toBeNull();
    expect(view.recipientPhone).toBeNull();
    // le reste de l'envoi est inchangé
    expect(view.id).toBe('s1');
    expect(view.status).toBe(status);
  });

  it.each(['DELIVERED', 'COMPLETED'])('client : plus le numéro du chauffeur (%s)', (status) => {
    const view = hideContactsOnceDelivered(shipment(status), 'customer');
    expect(view.driverPhone).toBeNull();
    // le client garde les numéros qu'il a lui-même saisis
    expect(view.senderPhone).toBe('+221700000001');
    expect(view.recipientPhone).toBe('+224620000002');
  });

  it.each(['DRIVER_ASSIGNED', 'PICKUP_PENDING', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERY_PENDING'])(
    'colis en cours (%s) : tous les numéros restent disponibles',
    (status) => {
      expect(hideContactsOnceDelivered(shipment(status), 'driver')).toEqual(shipment(status));
      expect(hideContactsOnceDelivered(shipment(status), 'customer')).toEqual(shipment(status));
    },
  );

  it('litige ouvert (DISPUTED) : les numéros reviennent le temps de le régler', () => {
    expect(hideContactsOnceDelivered(shipment('DISPUTED'), 'driver')).toEqual(shipment('DISPUTED'));
    expect(hideContactsOnceDelivered(shipment('DISPUTED'), 'customer')).toEqual(shipment('DISPUTED'));
  });

  it('une vue sans driverPhone (liste du client) n\'en reçoit pas', () => {
    const { driverPhone: _ignored, ...withoutDriverPhone } = shipment('DELIVERED');
    const view = hideContactsOnceDelivered(withoutDriverPhone, 'customer') as { driverPhone?: unknown };
    expect(view.driverPhone).toBeUndefined();
  });

  it('ne modifie pas l\'objet d\'origine', () => {
    const original = shipment('DELIVERED');
    hideContactsOnceDelivered(original, 'driver');
    expect(original.senderPhone).toBe('+221700000001');
  });
});
