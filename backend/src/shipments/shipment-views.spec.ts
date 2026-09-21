// backend/src/shipments/shipment-views.spec.ts
import { toAvailableShipmentView, type AvailableShipmentSource } from './shipment-views';

describe('toAvailableShipmentView', () => {
  const source = {
    id: 's1',
    status: 'SEARCHING_DRIVER',
    categoryId: 'cat1',
    category: { id: 'cat1', name: 'Documents', description: 'x', isAllowed: true },
    currency: { isoCode: 'GNF' },
    currencyId: 'cur1',
    senderName: 'Mamadou Diallo',
    senderPhone: '+224620000001',
    recipientName: 'Aïssatou Bah',
    recipientPhone: '+224620000002',
    instructions: 'Sonner deux fois chez Mme Bah, 12 rue des Manguiers',
    customerId: 'c1',
    senderLocation: { id: 'l1', label: '12 rue des Manguiers, Kaloum', formattedAddress: 'x', latitude: 1, longitude: 2, cityId: 'city1', city: { name: 'Conakry' } },
    recipientLocation: { id: 'l2', label: 'Domicile de Mme Bah', formattedAddress: 'y', latitude: 3, longitude: 4, cityId: 'city2', city: { name: 'Labé' } },
    weightKg: 5,
    quantity: 1,
    isUrgent: false,
    price: 150_000n,
    platformFee: 15_000n,
    totalAmount: 150_000n,
    windowStart: new Date(),
    windowEnd: new Date(),
    createdAt: new Date(),
  } as unknown as AvailableShipmentSource;

  it('ne contient ni nom, ni téléphone, ni consigne du client', () => {
    const json = JSON.stringify(toAvailableShipmentView(source), (_key, value) => (typeof value === 'bigint' ? value.toString() : value));
    expect(json).not.toContain('+2246200000');
    expect(json).not.toContain('Mamadou');
    expect(json).not.toContain('Aïssatou');
    expect(json).not.toContain('Manguiers');
    expect(json).not.toContain('Mme Bah');
  });

  it('réduit les adresses à leur ville', () => {
    const view = toAvailableShipmentView(source);
    expect(view.senderLocation).toEqual({ id: 'l1', label: 'Conakry', cityId: 'city1' });
    expect(view.recipientLocation).toEqual({ id: 'l2', label: 'Labé', cityId: 'city2' });
  });

  it('expose le code de devise pour afficher le bon montant', () => {
    expect(toAvailableShipmentView(source).currencyCode).toBe('GNF');
  });
});