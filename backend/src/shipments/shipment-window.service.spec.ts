// backend/src/shipments/shipment-window.service.spec.ts
import { ShipmentStatus } from '@prisma/client';
import { ShipmentWindowService } from './shipment-window.service';

/**
 * Tâche de fin de plage : invitation à prolonger, remboursement sans
 * réponse, nettoyage des envois impayés. Chaque étape est une mise à jour
 * conditionnelle — un envoi n'est jamais traité deux fois.
 */
function createService(options: { dueForExtension?: unknown[]; claimCount?: number; toExpire?: unknown[]; stale?: unknown[] } = {}) {
  const findMany = jest
    .fn()
    .mockResolvedValueOnce(options.dueForExtension ?? [])
    .mockResolvedValueOnce(options.toExpire ?? [])
    .mockResolvedValueOnce(options.stale ?? []);
  const prisma = {
    shipment: { findMany, updateMany: jest.fn().mockResolvedValue({ count: options.claimCount ?? 1 }) },
  };
  const pricing = { getNumericSetting: jest.fn().mockResolvedValue(24) };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const shipments = {
    expireSearch: jest.fn().mockResolvedValue(true),
    expireUnpaid: jest.fn().mockResolvedValue(true),
  };
  const service = new ShipmentWindowService(prisma as never, pricing as never, notifications as never, shipments as never);
  return { service, prisma, notifications, shipments };
}

describe('ShipmentWindowService.runOnce', () => {
  it('invite le client à prolonger quand la plage est terminée sans chauffeur', async () => {
    const { service, prisma, notifications } = createService({
      dueForExtension: [{ id: 's1', customer: { userId: 'u-customer' } }],
    });
    await service.runOnce();

    expect(prisma.shipment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 's1', status: ShipmentStatus.SEARCHING_DRIVER, extensionRequestedAt: null } }),
    );
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u-customer', pushData: { type: 'SHIPMENT_EXTENSION', shipmentId: 's1' } }),
    );
  });

  it('ne prévient pas deux fois : si un autre passage a déjà traité l\'envoi, rien n\'est envoyé', async () => {
    const { service, notifications } = createService({
      dueForExtension: [{ id: 's1', customer: { userId: 'u-customer' } }],
      claimCount: 0,
    });
    await service.runOnce();
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('rembourse (via expireSearch) les demandes restées sans réponse après le délai', async () => {
    const { service, shipments } = createService({ toExpire: [{ id: 's2' }] });
    await service.runOnce();
    expect(shipments.expireSearch).toHaveBeenCalledWith('s2', expect.stringContaining('remboursement intégral'));
  });

  it('annule les envois jamais payés', async () => {
    const { service, shipments } = createService({ stale: [{ id: 's3' }] });
    await service.runOnce();
    expect(shipments.expireUnpaid).toHaveBeenCalledWith('s3', expect.any(String));
  });

  it('continue avec les envois suivants quand l\'un échoue', async () => {
    const { service, shipments } = createService({ toExpire: [{ id: 'a' }, { id: 'b' }] });
    shipments.expireSearch.mockRejectedValueOnce(new Error('boom'));
    await service.runOnce();
    expect(shipments.expireSearch).toHaveBeenCalledTimes(2);
  });
});