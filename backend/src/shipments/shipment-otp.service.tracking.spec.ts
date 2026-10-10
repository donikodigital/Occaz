// backend/src/shipments/shipment-otp.service.tracking.spec.ts
// Chaque étape visible du suivi est annoncée par un événement et enregistre la position du trajet.
import { ShipmentOtpService } from './shipment-otp.service';

const NOW = new Date();

function build(shipmentRow: Record<string, unknown>, trip: Record<string, unknown> | null) {
  const prisma = {
    shipment: {
      findUnique: jest.fn().mockImplementation(async (args: { select?: unknown }) => (args.select ? { trip } : shipmentRow)),
      update: jest.fn().mockResolvedValue({ id: 's1' }),
    },
    shipmentTracking: { create: jest.fn().mockResolvedValue({}) },
    customerProfile: { findUnique: jest.fn().mockResolvedValue({ userId: 'u1' }) },
  };
  const events = { emit: jest.fn() };
  const otp = { verify: jest.fn().mockResolvedValue(undefined) };
  const wallets = { releaseHeldFunds: jest.fn().mockResolvedValue(undefined) };
  const drivers = { incrementCompletedShipments: jest.fn().mockResolvedValue(undefined) };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const service = new ShipmentOtpService(prisma as never, otp as never, wallets as never, drivers as never, notifications as never, events as never);
  return { service, prisma, events };
}

const base = { id: 's1', driverId: 'd1', customerId: 'c1', trip: null };

describe('ShipmentOtpService — suivi', () => {
  it('colis récupéré : historique daté avec la position du trajet, puis événement', async () => {
    const { service, prisma, events } = build(
      { ...base, status: 'PICKUP_PENDING' },
      { currentLatitude: 9.64, currentLongitude: -13.67, currentPositionUpdatedAt: NOW },
    );
    await service.verifyPickupOtp('s1', 'd1', '123456');
    expect(prisma.shipmentTracking.create).toHaveBeenCalledWith({
      data: { shipmentId: 's1', status: 'PICKED_UP', latitude: 9.64, longitude: -13.67 },
    });
    expect(events.emit).toHaveBeenCalledWith('shipment.status-changed', expect.objectContaining({ shipmentId: 's1', status: 'PICKED_UP' }));
  });

  it('sans trajet (conducteur sans trajet établi) : étape enregistrée sans position', async () => {
    const { service, prisma } = build({ ...base, status: 'PICKED_UP' }, null);
    await service.markInTransit('s1', 'd1');
    expect(prisma.shipmentTracking.create).toHaveBeenCalledWith({ data: { shipmentId: 's1', status: 'IN_TRANSIT', latitude: null, longitude: null } });
  });

  it('une position trop ancienne n\'est pas enregistrée', async () => {
    const { service, prisma } = build(
      { ...base, status: 'IN_TRANSIT' },
      { currentLatitude: 9.64, currentLongitude: -13.67, currentPositionUpdatedAt: new Date(NOW.getTime() - 2 * 3_600_000) },
    );
    await service.markDeliveryPending('s1', 'd1');
    expect(prisma.shipmentTracking.create.mock.calls[0][0].data).toMatchObject({ latitude: null, longitude: null });
  });

  it('livraison : DELIVERED est annoncé (puis COMPLETED, ignoré par le suivi)', async () => {
    const { service, events } = build({ ...base, status: 'DELIVERY_PENDING' }, null);
    await service.verifyDeliveryOtp('s1', 'd1', '123456');
    expect(events.emit.mock.calls.map((call) => call[1].status)).toEqual(['DELIVERED', 'COMPLETED']);
  });

  it('un code faux ne change rien et n\'annonce rien', async () => {
    const { service, events, prisma } = build({ ...base, status: 'PICKUP_PENDING' }, null);
    (service as unknown as { otpService: { verify: jest.Mock } }).otpService.verify.mockRejectedValue(new Error('Code invalide'));
    await expect(service.verifyPickupOtp('s1', 'd1', '000000')).rejects.toThrow('Code invalide');
    expect(events.emit).not.toHaveBeenCalled();
    expect(prisma.shipmentTracking.create).not.toHaveBeenCalled();
  });

  it('un conducteur étranger à l\'envoi est refusé avant tout enregistrement', async () => {
    const { service, events } = build({ ...base, status: 'PICKED_UP' }, null);
    await expect(service.markInTransit('s1', 'autre')).rejects.toThrow();
    expect(events.emit).not.toHaveBeenCalled();
  });
});
