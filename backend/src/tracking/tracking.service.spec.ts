// backend/src/tracking/tracking.service.spec.ts
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { shipmentTrackingNumber } from '../tickets/ticket-codes';

const SHIPMENT_ID = '7f3a91c2-b0aa-4c11-9d2e-111111111111';
const NUMBER = shipmentTrackingNumber(SHIPMENT_ID); // OCZ7F3A91C2B0
const NOW = new Date('2026-10-10T12:00:00Z');
const at = (hour: number) => new Date(`2026-10-10T${String(hour).padStart(2, '0')}:00:00Z`);

function stop(id: string, sequence: number, cityId: string, name: string, arrivedAt: Date | null) {
  return {
    id, sequence, cityId, city: { id: cityId, name }, locationId: `loc-${id}`, fareFromOrigin: BigInt(sequence * 10_000),
    distanceFromOriginKm: sequence * 50, estimatedArrivalAt: null, isBookable: true, arrivedAt,
  };
}

function shipment(overrides: Record<string, unknown> = {}) {
  return {
    id: SHIPMENT_ID,
    customerId: 'cust1',
    status: 'IN_TRANSIT',
    quantity: 2,
    updatedAt: at(9),
    senderLocation: { cityId: 'c-conakry', city: { name: 'Conakry' } },
    recipientLocation: { cityId: 'c-labe', city: { name: 'Labé' } },
    driver: { firstName: 'Mamadou' },
    tracking: [
      { status: 'SEARCHING_DRIVER', note: null, recordedAt: at(6) },
      { status: 'DRIVER_ASSIGNED', note: null, recordedAt: at(7) },
      { status: 'PICKED_UP', note: null, recordedAt: at(8) },
      { status: 'IN_TRANSIT', note: null, recordedAt: at(9) },
      { status: 'IN_TRANSIT', note: 'Passage à Kindia', recordedAt: at(10) },
    ],
    trip: {
      pricePerSeat: 100_000n,
      departureAt: at(8),
      originCityId: 'c-conakry', originLocationId: 'loc-o', originCity: { name: 'Conakry' },
      destinationCityId: 'c-labe', destinationLocationId: 'loc-d', destinationCity: { name: 'Labé' },
      stops: [stop('s1', 1, 'c-kindia', 'Kindia', at(10)), stop('s2', 2, 'c-mamou', 'Mamou', null)],
      currentLatitude: 10.1234,
      currentLongitude: -12.5678,
      currentPositionUpdatedAt: at(11),
    },
    ...overrides,
  };
}

function build(found: unknown, options: { rows?: Array<{ id: string }>; customerId?: string | null; staff?: boolean } = {}) {
  const prisma = {
    $queryRaw: jest.fn().mockResolvedValue(options.rows ?? [{ id: SHIPMENT_ID }]),
    shipment: { findFirst: jest.fn().mockResolvedValue(found) },
  };
  const customers = { findByUserId: jest.fn().mockImplementation(async () => { if (options.customerId === null) throw new Error('none'); return { id: options.customerId ?? 'cust1' }; }) };
  const scope = { hasShipmentAccess: jest.fn().mockResolvedValue(options.staff ?? false) };
  const service = new TrackingService(prisma as never, customers as never, scope as never);
  return { service, prisma, scope };
}

describe('TrackingService.findPublic', () => {
  it('trouve le colis par son numéro, même recopié à la main', async () => {
    const { service, prisma } = build(shipment());
    const view = await service.findPublic('ocz 7f3a 91c2 b0-02');
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(view.trackingNumber).toBe(NUMBER);
    expect(view.trackingNumberFormatted).toBe('OCZ 7F3A 91C2 B0');
    expect(view.parcelsCount).toBe(2);
  });

  it('refuse un numéro mal formé sans interroger la base', async () => {
    const { service, prisma } = build(shipment());
    await expect(service.findPublic('pas un numéro')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('numéro inconnu → introuvable', async () => {
    const { service } = build(null, { rows: [] });
    await expect(service.findPublic(NUMBER)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deux envois pour un même numéro → introuvable plutôt qu\'un choix au hasard', async () => {
    const { service } = build(shipment(), { rows: [{ id: 'a' }, { id: 'b' }] });
    await expect(service.findPublic(NUMBER)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('un envoi pas encore payé n\'existe pas pour le public', async () => {
    const { service } = build(shipment({ status: 'CREATED' }));
    await expect(service.findPublic(NUMBER)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('montre la route, le passage à Kindia et la position arrondie', async () => {
    const { service } = build(shipment());
    const view = await service.findPublic(NUMBER);
    expect(view.journey.map((point) => `${point.cityName}:${point.state}`)).toEqual(['Conakry:DONE', 'Kindia:DONE', 'Mamou:NEXT', 'Labé:TODO']);
    expect(view.headline).toBe('Entre Kindia et Mamou');
    expect(view.location).toMatchObject({ source: 'GPS', latitude: 10.1, longitude: -12.55, isApproximate: true });
    expect(view.events[0]).toMatchObject({ label: 'Passage à Kindia' });
    expect(view.driverFirstName).toBe('Mamadou');
  });

  it('ne laisse sortir ni nom, ni téléphone, ni adresse, ni montant', async () => {
    const { service } = build(
      shipment({
        senderName: 'Boubacar BARRY', senderPhone: '+224600000003', recipientName: 'Aïssatou Bah', recipientPhone: '+224620000002',
        recipientEmail: 'aissatou@example.com', totalAmount: 99_000n,
      }),
    );
    const json = JSON.stringify(await service.findPublic(NUMBER), (_key, value) => (typeof value === 'bigint' ? value.toString() : value));
    for (const secret of ['Boubacar', 'BARRY', '224600000003', 'Aïssatou', '224620000002', 'aissatou@example.com', '99000', 'cust1']) {
      expect(json).not.toContain(secret);
    }
  });

  it('une position GPS trop ancienne n\'est plus montrée : le suivi se rabat sur les villes', async () => {
    const old = shipment();
    old.trip.currentPositionUpdatedAt = new Date('2026-10-09T01:00:00Z');
    const view = await build(old).service.buildView(old as never, false, NOW);
    expect(view.location).toMatchObject({ source: 'CITIES', latitude: null, longitude: null });
  });

  it('une position récente mais vieille de plus de 15 minutes est signalée « dernière position connue »', () => {
    const { service } = build(null);
    const view = service.buildView(shipment() as never, false, NOW); // GPS à 11 h, il est 12 h
    expect(view.location.isStale).toBe(true);
    const fresh = shipment();
    fresh.trip.currentPositionUpdatedAt = new Date('2026-10-10T11:55:00Z');
    expect(service.buildView(fresh as never, false, NOW).location.isStale).toBe(false);
  });

  it('pas de position avant la prise en charge, même si le trajet partage la sienne', () => {
    const { service } = build(null);
    const view = service.buildView(shipment({ status: 'DRIVER_ASSIGNED' }) as never, false, NOW);
    expect(view.location).toMatchObject({ source: 'NONE', latitude: null });
  });

  it('colis transporté sans trajet : ramassage → livraison, sans GPS', () => {
    const { service } = build(null);
    const view = service.buildView(shipment({ trip: null }) as never, false, NOW);
    expect(view.journey.map((point) => point.cityName)).toEqual(['Conakry', 'Labé']);
    expect(view.location).toMatchObject({ source: 'CITIES' });
  });

  it('livré : tout est passé et le dernier état est « Colis livré »', () => {
    const { service } = build(null);
    const delivered = shipment({ status: 'COMPLETED' });
    delivered.tracking.push(
      { status: 'DELIVERED', note: null, recordedAt: at(15) },
      { status: 'COMPLETED', note: null, recordedAt: at(15) },
    );
    const view = service.buildView(delivered as never, false, NOW);
    expect(view.outcome).toBe('DELIVERED');
    expect(view.headline).toBe('Colis livré');
    expect(view.journey.every((point) => point.state === 'DONE')).toBe(true);
    expect(view.events[0].label).toBe('Colis livré');
    expect(view.events.filter((event) => event.status === 'COMPLETED')).toHaveLength(0);
  });
});

describe('TrackingService.findForUser', () => {
  const user = { id: 'u1' } as never;

  it('l\'expéditeur voit la position exacte', async () => {
    const { service } = build(shipment());
    const view = await service.findForUser(SHIPMENT_ID, user);
    expect(view.location).toMatchObject({ latitude: 10.1234, longitude: -12.5678, isApproximate: false });
  });

  it('un autre client est refusé', async () => {
    const { service } = build(shipment(), { customerId: 'autre' });
    await expect(service.findForUser(SHIPMENT_ID, user)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('un utilisateur sans profil client est refusé', async () => {
    const { service } = build(shipment(), { customerId: null });
    await expect(service.findForUser(SHIPMENT_ID, user)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('le support, dans son périmètre, y accède', async () => {
    const { service } = build(shipment(), { customerId: null, staff: true });
    await expect(service.findForUser(SHIPMENT_ID, user)).resolves.toMatchObject({ trackingNumber: NUMBER });
  });

  it('envoi inconnu → introuvable', async () => {
    const { service } = build(null);
    await expect(service.findForUser(SHIPMENT_ID, user)).rejects.toBeInstanceOf(NotFoundException);
  });
});
