// backend/src/tracking/tracking-notifications.service.spec.ts
import { TrackingNotificationsService } from './tracking-notifications.service';

const NOW = new Date();

function shipment(overrides: Record<string, unknown> = {}) {
  return {
    id: '7f3a91c2-b0aa-4c11-9d2e-111111111111',
    status: 'PICKED_UP',
    quantity: 1,
    senderName: 'Boubacar BARRY',
    recipientName: 'Aïssatou Bah',
    recipientEmail: 'aissatou@example.com',
    customer: { firstName: 'Boubacar', user: { id: 'u-sender', email: 'boubacar@example.com' } },
    senderLocation: { city: { name: 'Conakry' } },
    recipientLocation: { city: { name: 'Labé' } },
    driver: { firstName: 'Mamadou' },
    ...overrides,
  };
}

function build(found: unknown, env: string | null = 'https://app.occaz.example/') {
  if (env === null) delete process.env.TRACKING_BASE_URL;
  else process.env.TRACKING_BASE_URL = env;
  const prisma = {
    shipment: { findUnique: jest.fn().mockResolvedValue(found), findMany: jest.fn().mockResolvedValue([]) },
    shipmentTracking: { create: jest.fn().mockResolvedValue({}) },
  };
  const email = { send: jest.fn().mockResolvedValue(undefined) };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const service = new TrackingNotificationsService(prisma as never, email as never, notifications as never);
  return { service, prisma, email, notifications };
}

afterEach(() => {
  delete process.env.TRACKING_BASE_URL;
});

describe('annonce des étapes', () => {
  it('colis récupéré : e-mail à l\'expéditeur ET au destinataire, avec le lien de suivi', async () => {
    const { service, email } = build(shipment());
    await service.announceStatus('s1', 'PICKED_UP');
    expect(email.send).toHaveBeenCalledTimes(2);
    const recipients = email.send.mock.calls.map((call) => call[0]);
    expect(recipients).toEqual(['boubacar@example.com', 'aissatou@example.com']);
    // Pas de « / » doublé quand l'adresse configurée se termine par un « / ».
    expect(email.send.mock.calls[0][3]).toEqual({ url: 'https://app.occaz.example/suivi/OCZ7F3A91C2B0', label: 'Suivre mon colis' });
  });

  it('notifie aussi l\'expéditeur dans l\'application', async () => {
    const { service, notifications } = build(shipment());
    await service.announceStatus('s1', 'PICKED_UP');
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u-sender', channels: ['PUSH'], pushData: { type: 'SHIPMENT_TRACKING', shipmentId: 's1' } }),
    );
  });

  it('destinataire sans e-mail : seul l\'expéditeur est écrit, sans erreur', async () => {
    const { service, email } = build(shipment({ recipientEmail: null }));
    await service.announceStatus('s1', 'PICKED_UP');
    expect(email.send.mock.calls.map((call) => call[0])).toEqual(['boubacar@example.com']);
  });

  it('expéditeur sans e-mail : seul le destinataire est écrit', async () => {
    const { service, email } = build(shipment({ customer: { firstName: 'Boubacar', user: { id: 'u-sender', email: null } } }));
    await service.announceStatus('s1', 'PICKED_UP');
    expect(email.send.mock.calls.map((call) => call[0])).toEqual(['aissatou@example.com']);
  });

  it('conducteur trouvé : seul le destinataire est écrit (l\'expéditeur a déjà sa notification), pas de push de suivi', async () => {
    const { service, email, notifications } = build(shipment({ status: 'DRIVER_ASSIGNED' }));
    await service.announceStatus('s1', 'DRIVER_ASSIGNED');
    expect(email.send.mock.calls.map((call) => call[0])).toEqual(['aissatou@example.com']);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('livré : seul le destinataire est écrit (l\'expéditeur a déjà « Colis livré »)', async () => {
    const { service, email, notifications } = build(shipment({ status: 'COMPLETED' }));
    await service.announceStatus('s1', 'DELIVERED');
    expect(email.send.mock.calls.map((call) => call[0])).toEqual(['aissatou@example.com']);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('les étapes sans message (en route, terminé) n\'interrogent même pas la base', async () => {
    const { service, prisma, email } = build(shipment());
    await service.announceStatus('s1', 'IN_TRANSIT');
    await service.announceStatus('s1', 'COMPLETED');
    expect(prisma.shipment.findUnique).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });

  it('sans TRACKING_BASE_URL : l\'e-mail part sans bouton', async () => {
    const { service, email } = build(shipment(), null);
    await service.announceStatus('s1', 'PICKED_UP');
    expect(email.send.mock.calls[0][3]).toBeUndefined();
    expect(email.send.mock.calls[0][2]).toContain('OCZ 7F3A 91C2 B0');
  });

  it('un e-mail refusé n\'empêche ni l\'autre e-mail ni la notification', async () => {
    const { service, email, notifications } = build(shipment());
    email.send.mockRejectedValueOnce(new Error('Resend 500'));
    await service.announceStatus('s1', 'PICKED_UP');
    expect(email.send).toHaveBeenCalledTimes(2);
    expect(notifications.notify).toHaveBeenCalledTimes(1);
  });

  it('l\'écouteur d\'événement n\'échoue jamais : une erreur est journalisée', async () => {
    const { service, prisma } = build(shipment());
    prisma.shipment.findUnique.mockRejectedValue(new Error('db down'));
    await expect(service.onStatusChanged({ shipmentId: 's1', status: 'PICKED_UP' })).resolves.toBeUndefined();
  });

  it('envoi disparu : rien ne part', async () => {
    const { service, email } = build(null);
    await service.announceStatus('gone', 'PICKED_UP');
    expect(email.send).not.toHaveBeenCalled();
  });
});

describe('passage dans une ville traversée', () => {
  const carried = (extra: Record<string, unknown> = {}) => ({
    id: '7f3a91c2-b0aa-4c11-9d2e-111111111111',
    status: 'IN_TRANSIT',
    trip: { currentLatitude: 10.1, currentLongitude: -12.5, currentPositionUpdatedAt: NOW },
    recipientLocation: { city: { name: 'Labé' } },
    customer: { user: { id: 'u-sender' } },
    ...extra,
  });

  it('ajoute « Passage à Kindia » avec la position du moment et prévient l\'expéditeur', async () => {
    const { service, prisma, notifications } = build(null);
    prisma.shipment.findMany.mockResolvedValue([carried()]);
    await service.recordPassage('trip1', 'Kindia');
    expect(prisma.shipmentTracking.create).toHaveBeenCalledWith({
      data: { shipmentId: expect.any(String), status: 'IN_TRANSIT', note: 'Passage à Kindia', latitude: 10.1, longitude: -12.5 },
    });
    expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u-sender', channels: ['PUSH'] }));
  });

  it('sans position récente, enregistre le passage sans coordonnées', async () => {
    const { service, prisma } = build(null);
    prisma.shipment.findMany.mockResolvedValue([carried({ trip: { currentLatitude: 10.1, currentLongitude: -12.5, currentPositionUpdatedAt: new Date(NOW.getTime() - 3 * 3_600_000) } })]);
    await service.recordPassage('trip1', 'Kindia');
    expect(prisma.shipmentTracking.create.mock.calls[0][0].data).toMatchObject({ latitude: null, longitude: null });
  });

  it('un colis qui doit être livré dans cette ville est laissé à ses propres étapes', async () => {
    const { service, prisma, notifications } = build(null);
    prisma.shipment.findMany.mockResolvedValue([carried({ recipientLocation: { city: { name: 'Kindia' } } })]);
    await service.recordPassage('trip1', 'Kindia');
    expect(prisma.shipmentTracking.create).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('ne retient que les colis réellement en transit sur ce trajet', async () => {
    const { service, prisma } = build(null);
    await service.recordPassage('trip1', 'Kindia');
    expect(prisma.shipment.findMany.mock.calls[0][0].where).toMatchObject({
      tripId: 'trip1',
      deletedAt: null,
      status: { in: ['PICKED_UP', 'IN_TRANSIT', 'DELIVERY_PENDING'] },
    });
  });

  it('l\'échec d\'un colis n\'empêche pas les autres', async () => {
    const { service, prisma } = build(null);
    prisma.shipment.findMany.mockResolvedValue([carried({ id: 'a' }), carried({ id: 'b' })]);
    prisma.shipmentTracking.create.mockRejectedValueOnce(new Error('db')).mockResolvedValueOnce({});
    await service.recordPassage('trip1', 'Kindia');
    expect(prisma.shipmentTracking.create).toHaveBeenCalledTimes(2);
  });

  it('l\'écouteur d\'événement n\'échoue jamais', async () => {
    const { service, prisma } = build(null);
    prisma.shipment.findMany.mockRejectedValue(new Error('db down'));
    await expect(service.onStopReached({ tripId: 't', cityName: 'Kindia' })).resolves.toBeUndefined();
  });
});
