// backend/src/shipments/shipment-otp.service.guard.spec.ts
// Un envoi annulé (ou dont l'état a changé entre-temps) ne peut plus être récupéré ni livré, même avec un code encore valable.
import { BadRequestException } from '@nestjs/common';
import { ShipmentOtpService } from './shipment-otp.service';

function build(status: string, claimCount = 1) {
  const prisma = {
    shipment: {
      findUnique: jest.fn().mockResolvedValue({ id: 's1', driverId: 'd1', customerId: 'c1', status, trip: null }),
      updateMany: jest.fn().mockResolvedValue({ count: claimCount }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 's1' }),
    },
    shipmentTracking: { create: jest.fn().mockResolvedValue({}) },
    customerProfile: { findUnique: jest.fn().mockResolvedValue({ userId: 'u1' }) },
  };
  const otp = { verify: jest.fn().mockResolvedValue(undefined) };
  const wallets = { releaseHeldFunds: jest.fn().mockResolvedValue(undefined) };
  const drivers = { incrementCompletedShipments: jest.fn().mockResolvedValue(undefined) };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const events = { emit: jest.fn() };
  const service = new ShipmentOtpService(prisma as never, otp as never, wallets as never, drivers as never, notifications as never, events as never);
  return { service, prisma, otp, wallets, drivers, events };
}

describe('ShipmentOtpService — envoi annulé ou état changé', () => {
  it('refuse le code de récupération d’un envoi annulé, sans consommer le code', async () => {
    const { service, otp, prisma } = build('CANCELLED');
    await expect(service.verifyPickupOtp('s1', 'd1', '123456')).rejects.toBeInstanceOf(BadRequestException);
    expect(otp.verify).not.toHaveBeenCalled();
    expect(prisma.shipment.updateMany).not.toHaveBeenCalled();
  });

  it('refuse le code de livraison d’un envoi annulé, sans libérer les fonds du conducteur', async () => {
    const { service, otp, wallets, drivers } = build('CANCELLED');
    await expect(service.verifyDeliveryOtp('s1', 'd1', '123456')).rejects.toBeInstanceOf(BadRequestException);
    expect(otp.verify).not.toHaveBeenCalled();
    expect(wallets.releaseHeldFunds).not.toHaveBeenCalled();
    expect(drivers.incrementCompletedShipments).not.toHaveBeenCalled();
  });

  it('annulation survenue entre la lecture et l’écriture : la transition échoue, rien n’est enregistré ni payé', async () => {
    const { service, wallets, events } = build('DELIVERY_PENDING', 0);
    await expect(service.verifyDeliveryOtp('s1', 'd1', '123456')).rejects.toBeInstanceOf(BadRequestException);
    expect(wallets.releaseHeldFunds).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('la transition est conditionnée à l’état attendu', async () => {
    const { service, prisma } = build('PICKED_UP');
    await service.markInTransit('s1', 'd1');
    expect(prisma.shipment.updateMany).toHaveBeenCalledWith({ where: { id: 's1', status: 'PICKED_UP' }, data: { status: 'IN_TRANSIT' } });
  });

  it('validation manuelle du support concurrente d’une livraison déjà faite : les fonds ne sont pas libérés deux fois', async () => {
    const { service, wallets, drivers } = build('DELIVERY_PENDING', 0);
    await expect(service.manuallyValidateDelivery('s1')).rejects.toBeInstanceOf(BadRequestException);
    expect(wallets.releaseHeldFunds).not.toHaveBeenCalled();
    expect(drivers.incrementCompletedShipments).not.toHaveBeenCalled();
  });
});
