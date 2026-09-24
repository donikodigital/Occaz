// backend/src/shipments/shipments.service.accept.spec.ts
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { DriverAccountStatus, ShipmentStatus } from '@prisma/client';
import { ShipmentsService } from './shipments.service';

/**
 * Acceptation d'un envoi : "le premier qui accepte l'emporte", sans
 * trajet obligatoire, réservé aux chauffeurs validés. Dépendances
 * mockées à la main (même approche que bookings.service.spec.ts).
 */
const future = new Date(Date.now() + 3 * 86_400_000);
const past = new Date(Date.now() - 86_400_000);

function baseShipment(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    status: ShipmentStatus.SEARCHING_DRIVER,
    customerId: 'c1',
    weightKg: 5,
    totalAmount: 150_000n,
    platformFee: 15_000n,
    currencyId: 'cur1',
    windowStart: past,
    windowEnd: future,
    ...overrides,
  };
}

function createService(options: {
  driverStatus?: DriverAccountStatus | null;
  shipment?: Record<string, unknown>;
  claimCount?: number;
}) {
  const tx = {
    shipment: {
      updateMany: jest.fn().mockResolvedValue({ count: options.claimCount ?? 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 's1', status: ShipmentStatus.DRIVER_ASSIGNED }),
    },
    trip: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    shipmentTracking: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    driverProfile: {
      findUnique: jest
        .fn()
        .mockResolvedValue(options.driverStatus === null ? null : { id: 'd1', status: options.driverStatus ?? DriverAccountStatus.VALIDATED }),
    },
    shipment: { findUnique: jest.fn().mockResolvedValue(options.shipment ?? baseShipment()) },
    customerProfile: { findUnique: jest.fn().mockResolvedValue({ userId: 'u-customer' }) },
    $transaction: jest.fn().mockImplementation((callback: (client: unknown) => unknown) => callback(tx)),
  };
  const wallets = { holdShipmentRevenue: jest.fn().mockResolvedValue(undefined) };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const service = new ShipmentsService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    wallets as never,
    { emit: jest.fn() } as never,
    notifications as never,
    {} as never,
  );
  return { service, tx, wallets, notifications };
}

describe('ShipmentsService.accept', () => {
  it('refuse un chauffeur dont le compte n\'est pas validé', async () => {
    const { service } = createService({ driverStatus: DriverAccountStatus.IN_VERIFICATION });
    await expect(service.accept('s1', 'u1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuse un utilisateur sans profil chauffeur', async () => {
    const { service } = createService({ driverStatus: null });
    await expect(service.accept('s1', 'u1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuse un envoi déjà pris', async () => {
    const { service } = createService({ shipment: baseShipment({ status: ShipmentStatus.DRIVER_ASSIGNED }) });
    await expect(service.accept('s1', 'u1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('le second chauffeur perd la course : aucune retenue de fonds, aucun suivi créé', async () => {
    // Les deux chauffeurs ont vu SEARCHING_DRIVER, mais l'attribution conditionnelle ne réussit qu'une fois.
    const { service, tx, wallets } = createService({ claimCount: 0 });
    await expect(service.accept('s1', 'u1')).rejects.toBeInstanceOf(ConflictException);
    expect(wallets.holdShipmentRevenue).not.toHaveBeenCalled();
    expect(tx.shipmentTracking.create).not.toHaveBeenCalled();
  });

  it('accepte sans trajet, retient le gain net : 150 000 payés, 15 000 de commission', async () => {
    const { service, tx, wallets, notifications } = createService({});
    await service.accept('s1', 'u1');

    expect(tx.shipment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 's1', status: ShipmentStatus.SEARCHING_DRIVER }),
        data: { status: ShipmentStatus.DRIVER_ASSIGNED, driverId: 'd1', tripId: null },
      }),
    );
    expect(tx.trip.updateMany).not.toHaveBeenCalled();
    expect(wallets.holdShipmentRevenue).toHaveBeenCalledWith(
      expect.objectContaining({ driverId: 'd1', grossAmount: 150_000n, commission: 15_000n }),
    );
    expect(notifications.notify).toHaveBeenCalledTimes(1);
  });

  it('refuse un envoi dont la plage de dates est terminée', async () => {
    const { service } = createService({ shipment: baseShipment({ windowEnd: past }) });
    await expect(service.accept('s1', 'u1')).rejects.toThrow('terminée');
  });
});