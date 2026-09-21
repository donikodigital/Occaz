// backend/src/shipments/shipment-dispatch.service.spec.ts
import { DriverAccountStatus, NotificationChannel, NotificationType, ShipmentStatus } from '@prisma/client';
import { SHIPMENT_REQUEST_CHANNEL_ID, ShipmentDispatchService } from './shipment-dispatch.service';

/**
 * Annonce d'une demande d'envoi : tous les chauffeurs validés, en même
 * temps, avec ou sans trajet — sans jamais divulguer de donnée du client.
 */
function createService(options: { status?: ShipmentStatus; emailSetting?: number; driverCount?: number } = {}) {
  const shipment = {
    id: 's1',
    status: options.status ?? ShipmentStatus.SEARCHING_DRIVER,
    isUrgent: false,
    weightKg: 5,
    totalAmount: 150_000n,
    platformFee: 15_000n,
    windowEnd: new Date('2026-09-27T18:00:00Z'),
    category: { name: 'Documents' },
    currency: { isoCode: 'GNF' },
    // Champs personnels présents en base : ils ne doivent jamais apparaître dans l'annonce.
    senderName: 'Mamadou Diallo',
    senderPhone: '+224620000001',
    recipientName: 'Aïssatou Bah',
    recipientPhone: '+224620000002',
    senderLocation: { label: '12 rue des Manguiers', city: { name: 'Conakry' } },
    recipientLocation: { label: 'Domicile de Mme Bah', city: { name: 'Labé' } },
  };
  const drivers = Array.from({ length: options.driverCount ?? 3 }, (_, index) => ({ userId: `u${index + 1}` }));
  const prisma = {
    shipment: { findUnique: jest.fn().mockResolvedValue(shipment) },
    driverProfile: { findMany: jest.fn().mockResolvedValue(drivers) },
  };
  const pricing = { getNumericSetting: jest.fn().mockResolvedValue(options.emailSetting ?? 1) };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const service = new ShipmentDispatchService(prisma as never, pricing as never, notifications as never);
  return { service, prisma, notifications };
}

describe('ShipmentDispatchService.dispatch', () => {
  it('prévient tous les chauffeurs validés et non suspendus, avec ou sans trajet', async () => {
    const { service, prisma, notifications } = createService({ driverCount: 3 });
    await expect(service.dispatch('s1')).resolves.toBe(3);

    expect(prisma.driverProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: DriverAccountStatus.VALIDATED, user: { isSuspended: false } }),
      }),
    );
    expect(notifications.notify).toHaveBeenCalledTimes(3);
    const userIds = notifications.notify.mock.calls.map(([params]) => params.userId);
    expect(userIds).toEqual(['u1', 'u2', 'u3']);
  });

  it('envoie un push prioritaire qui sonne, avec le gain net : 150 000 payés, 15 000 de commission', async () => {
    const { service, notifications } = createService({ driverCount: 1 });
    await service.dispatch('s1');

    const params = notifications.notify.mock.calls[0][0];
    expect(params.type).toBe(NotificationType.SHIPMENT_REQUEST);
    expect(params.pushOptions).toEqual({ channelId: SHIPMENT_REQUEST_CHANNEL_ID, priority: 'high' });
    expect(params.pushData).toEqual({ type: 'SHIPMENT_REQUEST', shipmentId: 's1' });
    // Espace insécable de Intl : on normalise avant de comparer.
    expect(params.fallbackBody.replace(/\s/g, ' ')).toContain('135 000 GNF');
    expect(params.fallbackBody).toContain('Conakry');
    expect(params.fallbackBody).toContain('Labé');
  });

  it('ne divulgue aucune donnée personnelle du client', async () => {
    const { service, notifications } = createService({ driverCount: 1 });
    await service.dispatch('s1');

    const everything = JSON.stringify(notifications.notify.mock.calls[0][0]);
    for (const secret of ['Mamadou', 'Aïssatou', '+2246200000', 'Manguiers', 'Mme Bah']) {
      expect(everything).not.toContain(secret);
    }
  });

  it('ajoute l\'e-mail par défaut, et le coupe quand le réglage passe à 0', async () => {
    const withEmail = createService({ driverCount: 1, emailSetting: 1 });
    await withEmail.service.dispatch('s1');
    expect(withEmail.notifications.notify.mock.calls[0][0].channels).toEqual([NotificationChannel.PUSH, NotificationChannel.EMAIL]);

    const pushOnly = createService({ driverCount: 1, emailSetting: 0 });
    await pushOnly.service.dispatch('s1');
    expect(pushOnly.notifications.notify.mock.calls[0][0].channels).toEqual([NotificationChannel.PUSH]);
  });

  it('n\'annonce rien si l\'envoi n\'est plus en recherche (déjà accepté ou annulé)', async () => {
    const { service, notifications } = createService({ status: ShipmentStatus.DRIVER_ASSIGNED });
    await expect(service.dispatch('s1')).resolves.toBe(0);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('continue d\'annoncer aux autres chauffeurs quand une notification échoue', async () => {
    const { service, notifications } = createService({ driverCount: 3 });
    notifications.notify.mockRejectedValueOnce(new Error('push indisponible'));
    await expect(service.dispatch('s1')).resolves.toBe(3);
    expect(notifications.notify).toHaveBeenCalledTimes(3);
  });
});