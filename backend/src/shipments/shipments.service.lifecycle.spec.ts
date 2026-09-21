// backend/src/shipments/shipments.service.lifecycle.spec.ts
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CancellationInitiator, ShipmentStatus } from '@prisma/client';
import { DOMAIN_EVENTS } from '../common/events/domain-events';
import { ShipmentsService } from './shipments.service';

/**
 * Fin de vie d'un envoi : annulation remboursée à 100 %, prolongation par
 * le client, expiration sans chauffeur, nettoyage des envois impayés.
 * Dépendances mockées à la main (même approche que les autres specs).
 */
const future = new Date(Date.now() + 3 * 86_400_000);

function shipment(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    status: ShipmentStatus.SEARCHING_DRIVER,
    customerId: 'c1',
    driverId: null,
    tripId: null,
    weightKg: 5,
    windowStart: new Date(),
    windowEnd: future,
    ...overrides,
  };
}

function createService(options: { shipment?: Record<string, unknown>; claimCount?: number; trip?: Record<string, unknown> | null } = {}) {
  const tx = {
    shipment: {
      updateMany: jest.fn().mockResolvedValue({ count: options.claimCount ?? 1 }),
      update: jest.fn().mockResolvedValue({ id: 's1' }),
      findUnique: jest.fn().mockResolvedValue(options.shipment ?? shipment()),
    },
    trip: {
      findUnique: jest.fn().mockResolvedValue(options.trip ?? null),
      update: jest.fn().mockResolvedValue({}),
    },
    shipmentTracking: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    shipment: { findUnique: jest.fn().mockResolvedValue(options.shipment ?? shipment()) },
    driverProfile: { findUnique: jest.fn().mockResolvedValue({ userId: 'u-driver' }) },
    customerProfile: { findUnique: jest.fn().mockResolvedValue({ userId: 'u-customer' }) },
    $transaction: jest.fn().mockImplementation((callback: (client: unknown) => unknown) => callback(tx)),
  };
  const eventEmitter = { emit: jest.fn() };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const service = new ShipmentsService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    eventEmitter as never,
    notifications as never,
  );
  return { service, tx, eventEmitter, notifications };
}

describe('ShipmentsService.cancel', () => {
  it('rembourse 100 % quand le client annule après qu\'un chauffeur a accepté', async () => {
    const { service, eventEmitter } = createService({ shipment: shipment({ status: ShipmentStatus.DRIVER_ASSIGNED, driverId: 'd1' }) });
    const result = await service.cancel('s1', 'Changement de plan', CancellationInitiator.CUSTOMER, { customerId: 'c1' });

    expect(result.refundEligiblePercentage).toBe(100);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      DOMAIN_EVENTS.SHIPMENT_CANCELLED,
      expect.objectContaining({ shipmentId: 's1', refundEligiblePercentage: 100 }),
    );
  });

  it('prévient le chauffeur quand le client annule (il ne se déplace pas pour rien)', async () => {
    const { service, notifications } = createService({ shipment: shipment({ status: ShipmentStatus.DRIVER_ASSIGNED, driverId: 'd1' }) });
    await service.cancel('s1', 'Changement de plan', CancellationInitiator.CUSTOMER, { customerId: 'c1' });

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u-driver' }));
  });

  it('prévient le client quand le chauffeur annule, en lui rappelant le remboursement', async () => {
    const { service, notifications } = createService({ shipment: shipment({ status: ShipmentStatus.DRIVER_ASSIGNED, driverId: 'd1' }) });
    await service.cancel('s1', 'Empêchement', CancellationInitiator.DRIVER, { driverId: 'd1' });

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u-customer', fallbackBody: expect.stringContaining('remboursé intégralement') }),
    );
  });

  it('ne fait pas échouer l\'annulation quand la notification échoue', async () => {
    const { service, notifications } = createService({ shipment: shipment({ status: ShipmentStatus.DRIVER_ASSIGNED, driverId: 'd1' }) });
    notifications.notify.mockRejectedValue(new Error('push indisponible'));
    await expect(
      service.cancel('s1', 'Changement de plan', CancellationInitiator.CUSTOMER, { customerId: 'c1' }),
    ).resolves.toBeDefined();
  });

  it('refuse au client d\'annuler un colis déjà récupéré (le recours est un litige)', async () => {
    const { service, eventEmitter } = createService({ shipment: shipment({ status: ShipmentStatus.PICKED_UP, driverId: 'd1' }) });
    await expect(
      service.cancel('s1', 'Trop tard', CancellationInitiator.CUSTOMER, { customerId: 'c1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('refuse aussi au chauffeur d\'annuler un colis en transit', async () => {
    const { service } = createService({ shipment: shipment({ status: ShipmentStatus.IN_TRANSIT, driverId: 'd1' }) });
    await expect(
      service.cancel('s1', 'Panne', CancellationInitiator.DRIVER, { driverId: 'd1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('laisse le support annuler un envoi en transit', async () => {
    const { service } = createService({ shipment: shipment({ status: ShipmentStatus.IN_TRANSIT, driverId: 'd1' }) });
    await expect(service.cancel('s1', 'Décision support', CancellationInitiator.SUPPORT)).resolves.toBeDefined();
  });

  it('refuse à un autre client d\'annuler cet envoi', async () => {
    const { service } = createService();
    await expect(
      service.cancel('s1', 'Pas le mien', CancellationInitiator.CUSTOMER, { customerId: 'autre-client' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('libère la capacité réservée sur le trajet quand un envoi rattaché est annulé', async () => {
    const { service, tx } = createService({
      shipment: shipment({ status: ShipmentStatus.DRIVER_ASSIGNED, driverId: 'd1', tripId: 't1' }),
      trip: { id: 't1', availableShipmentWeightKg: 10 },
    });
    await service.cancel('s1', 'Annulé', CancellationInitiator.CUSTOMER, { customerId: 'c1' });
    expect(tx.trip.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { availableShipmentWeightKg: { increment: 5 } },
    });
  });
});

describe('ShipmentsService.extendWindow', () => {
  it('prolonge, efface la demande de prolongation et prévient de nouveau les chauffeurs', async () => {
    const { service, tx, eventEmitter } = createService({ shipment: shipment({ extensionRequestedAt: new Date() }) });
    const newEnd = new Date(Date.now() + 7 * 86_400_000).toISOString();
    await service.extendWindow('s1', 'c1', newEnd);

    expect(tx.shipment.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { windowEnd: new Date(newEnd), extensionRequestedAt: null },
    });
    expect(eventEmitter.emit).toHaveBeenCalledWith(DOMAIN_EVENTS.SHIPMENT_SEARCH_OPENED, expect.objectContaining({ shipmentId: 's1' }));
  });

  it('refuse une date passée', async () => {
    const { service } = createService();
    await expect(service.extendWindow('s1', 'c1', new Date(Date.now() - 1000).toISOString())).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse un envoi qui n\'est plus en recherche', async () => {
    const { service } = createService({ shipment: shipment({ status: ShipmentStatus.DRIVER_ASSIGNED }) });
    await expect(service.extendWindow('s1', 'c1', future.toISOString())).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse à un autre client', async () => {
    const { service } = createService();
    await expect(service.extendWindow('s1', 'autre', future.toISOString())).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('ShipmentsService.expireSearch', () => {
  it('annule et déclenche un remboursement à 100 % quand personne n\'a accepté', async () => {
    const { service, eventEmitter } = createService({ claimCount: 1 });
    await expect(service.expireSearch('s1', 'Sans prolongation')).resolves.toBe(true);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      DOMAIN_EVENTS.SHIPMENT_CANCELLED,
      expect.objectContaining({ shipmentId: 's1', refundEligiblePercentage: 100 }),
    );
  });

  it('ne fait rien si un chauffeur a accepté entre-temps (aucun remboursement)', async () => {
    const { service, tx, eventEmitter } = createService({ claimCount: 0 });
    await expect(service.expireSearch('s1', 'Sans prolongation')).resolves.toBe(false);
    expect(tx.shipmentTracking.create).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});

describe('ShipmentsService.expireUnpaid', () => {
  it('libère la capacité du trajet réservée à la création', async () => {
    const { service, tx } = createService({
      shipment: shipment({ status: ShipmentStatus.CREATED, tripId: 't1' }),
      trip: { id: 't1', availableShipmentWeightKg: 3 },
    });
    await expect(service.expireUnpaid('s1', 'Jamais payé')).resolves.toBe(true);
    expect(tx.trip.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { availableShipmentWeightKg: { increment: 5 } },
    });
  });

  it('laisse un envoi payé entre-temps tranquille', async () => {
    const { service, tx } = createService({ claimCount: 0, shipment: shipment({ status: ShipmentStatus.CREATED, tripId: 't1' }) });
    await expect(service.expireUnpaid('s1', 'Jamais payé')).resolves.toBe(false);
    expect(tx.trip.update).not.toHaveBeenCalled();
  });
});