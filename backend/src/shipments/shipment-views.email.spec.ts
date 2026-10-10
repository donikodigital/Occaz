// backend/src/shipments/shipment-views.email.spec.ts
import { hideContactsOnceDelivered } from './shipment-views';

const shipment = {
  id: 's1', status: 'IN_TRANSIT', senderPhone: '+224600000003', recipientPhone: '+224620000002', recipientEmail: 'aissatou@example.com', driverPhone: '+224611111111',
};

describe("e-mail du destinataire", () => {
  it('le conducteur ne le reçoit jamais, même en cours de route', () => {
    const view = hideContactsOnceDelivered(shipment, 'driver');
    expect(view).not.toHaveProperty('recipientEmail');
    expect(view.recipientPhone).toBe('+224620000002');
  });

  it('le conducteur ne le reçoit pas non plus une fois livré', () => {
    const view = hideContactsOnceDelivered({ ...shipment, status: 'COMPLETED' }, 'driver');
    expect(view).not.toHaveProperty('recipientEmail');
    expect(view.recipientPhone).toBeNull();
  });

  it('l\'expéditeur le retrouve', () => {
    expect(hideContactsOnceDelivered(shipment, 'customer')).toMatchObject({ recipientEmail: 'aissatou@example.com' });
  });

  it('un envoi sans e-mail passe tel quel', () => {
    const { recipientEmail: _omit, ...without } = shipment;
    expect(hideContactsOnceDelivered(without, 'driver')).toEqual(without);
  });
});
