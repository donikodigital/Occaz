// backend/src/shipments/shipments.service.confirm-payment.spec.ts
// Confirmation du paiement d'un envoi : décision atomique, un envoi annulé n'est jamais ressuscité par un paiement tardif.
import { ShipmentStatus } from '@prisma/client';
import { ShipmentsService } from './shipments.service';

function build(options: { status: ShipmentStatus; driverId?: string | null; claimCount?: number; statusAfter?: ShipmentStatus }) {
  const tx = {
    shipment: { updateMany: jest.fn().mockResolvedValue({ count: options.claimCount ?? 1 }) },
    shipmentTracking: { create: jest.fn().mockResolvedValue({}) },
  };
  const findUnique = jest.fn().mockResolvedValueOnce({ id: 's1', status: options.status, driverId: options.driverId ?? null });
  if (options.statusAfter) findUnique.mockResolvedValueOnce({ status: options.statusAfter });
  const prisma = {
    shipment: { findUnique },
    $transaction: jest.fn().mockImplementation((callback: (client: unknown) => unknown) => callback(tx)),
  };
  const emit = jest.fn();
  const service = new ShipmentsService(prisma as never, {} as never, {} as never, {} as never, {} as never, { emit } as never, {} as never, {} as never);
  return { service, tx, emit };
}

describe('ShipmentsService.confirmPayment', () => {
  it('envoi à payer : passage réclamé en une écriture conditionnelle (statut encore CREATED), recherche de conducteur ouverte', async () => {
    const { service, tx, emit } = build({ status: ShipmentStatus.CREATED });
    await expect(service.confirmPayment('s1')).resolves.toBe('CONFIRMED');
    expect(tx.shipment.updateMany).toHaveBeenCalledWith({ where: { id: 's1', status: ShipmentStatus.CREATED }, data: { status: ShipmentStatus.SEARCHING_DRIVER } });
    expect(emit).toHaveBeenCalledTimes(2); // paiement confirmé + recherche ouverte
  });

  it('conducteur déjà choisi : DRIVER_ASSIGNED, pas de recherche', async () => {
    const { service, tx, emit } = build({ status: ShipmentStatus.CREATED, driverId: 'd1' });
    await expect(service.confirmPayment('s1')).resolves.toBe('CONFIRMED');
    expect(tx.shipment.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: ShipmentStatus.DRIVER_ASSIGNED } }));
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('envoi déjà annulé : NOT_PAYABLE, rien n\'est écrit (l\'appelant rembourse)', async () => {
    const { service, tx } = build({ status: ShipmentStatus.CANCELLED });
    await expect(service.confirmPayment('s1')).resolves.toBe('NOT_PAYABLE');
    expect(tx.shipment.updateMany).not.toHaveBeenCalled();
  });

  it('annulé PENDANT la confirmation (l\'écriture conditionnelle ne trouve plus CREATED) : NOT_PAYABLE, aucun événement', async () => {
    const { service, emit } = build({ status: ShipmentStatus.CREATED, claimCount: 0, statusAfter: ShipmentStatus.CANCELLED });
    await expect(service.confirmPayment('s1')).resolves.toBe('NOT_PAYABLE');
    expect(emit).not.toHaveBeenCalled();
  });

  it('déjà confirmé par un autre appel : ALREADY_CONFIRMED (idempotent)', async () => {
    const { service, emit } = build({ status: ShipmentStatus.SEARCHING_DRIVER });
    await expect(service.confirmPayment('s1')).resolves.toBe('ALREADY_CONFIRMED');
    expect(emit).not.toHaveBeenCalled();
  });
});
