// backend/src/shipments/shipment-invitations.service.spec.ts
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { ShipmentInvitationStatus, ShipmentStatus, TripStatus } from '@prisma/client';
import { ShipmentInvitationsService, effectiveStatus } from './shipment-invitations.service';
import { buildInvitationMessage } from './shipment-invitation-message';

const DAY = 86_400_000;
const inDays = (n: number) => new Date(Date.now() + n * DAY);

function shipmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    customerId: 'c1',
    status: ShipmentStatus.SEARCHING_DRIVER,
    weightKg: 5,
    windowStart: inDays(-1),
    windowEnd: inDays(10),
    category: { id: 'cat1', name: 'Colis' },
    currency: { isoCode: 'GNF' },
    senderLocation: { id: 'l1', cityId: 'conakry', label: 'Rue 1', city: { name: 'Conakry' } },
    recipientLocation: { id: 'l2', cityId: 'labe', label: 'Marché', city: { name: 'Labé' } },
    ...overrides,
  };
}

function tripRow(id: string, driverId: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    driverId,
    status: TripStatus.PUBLISHED,
    allowsShipments: true,
    departureAt: inDays(2),
    pricePerSeat: 100_000n,
    originCityId: 'conakry',
    originLocationId: 'lo',
    destinationCityId: 'labe',
    destinationLocationId: 'ld',
    maxShipmentWeightKg: null,
    availableShipmentWeightKg: null,
    stops: [] as unknown[],
    driver: { firstName: 'Mamadou', lastName: 'Barry', userId: `u-${driverId}`, id: driverId },
    vehicle: { brand: 'Toyota', model: 'Corolla', color: 'Gris' },
    originCity: { name: 'Conakry' },
    destinationCity: { name: 'Labé' },
    ...overrides,
  };
}

function stop(sequence: number, cityId: string, cityName: string) {
  return {
    id: `st${sequence}`,
    sequence,
    cityId,
    city: { name: cityName },
    locationId: `loc-${cityId}`,
    fareFromOrigin: 50_000n,
    distanceFromOriginKm: 100,
    estimatedArrivalAt: inDays(2.3),
    isBookable: true,
  };
}

function build(options: {
  shipment?: Record<string, unknown> | null;
  trips?: unknown[];
  invitations?: unknown[];
  acceptImpl?: jest.Mock;
  invitation?: Record<string, unknown> | null;
} = {}) {
  const prisma = {
    shipment: {
      findUnique: jest.fn().mockResolvedValue(options.shipment === undefined ? shipmentRow() : options.shipment),
    },
    trip: {
      findMany: jest.fn().mockResolvedValue(options.trips ?? []),
      findUnique: jest.fn().mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve((options.trips ?? []).find((trip) => (trip as { id: string }).id === where.id) ?? null),
      ),
    },
    shipmentInvitation: {
      findMany: jest.fn().mockResolvedValue(options.invitations ?? []),
      findUnique: jest.fn().mockResolvedValue(options.invitation === undefined ? null : options.invitation),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const shipments = {
    requireEligibleDriver: jest.fn().mockResolvedValue('d1'),
    accept: options.acceptImpl ?? jest.fn().mockResolvedValue({ id: 's1', status: ShipmentStatus.DRIVER_ASSIGNED }),
  };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const service = new ShipmentInvitationsService(prisma as never, shipments as never, notifications as never);
  return { service, prisma, shipments, notifications };
}

describe('buildInvitationMessage', () => {
  it('écrit « un colis » par défaut et « un courrier » pour une catégorie courrier / documents', () => {
    const parcel = buildInvitationMessage({ driverFirstName: 'Mamadou', driverLastName: 'Barry', categoryName: 'Colis', destinationCity: 'Labé' });
    expect(parcel).toContain('Bonjour Mamadou Barry,');
    expect(parcel).toContain("J'ai préparé un colis à envoyer à destination de Labé.");
    expect(parcel).toContain('Pourriez-vous l\'accepter, s\'il vous plaît ?');
    expect(parcel).toContain('Je vous remercie d’avance.');

    const letter = buildInvitationMessage({ driverFirstName: 'A', driverLastName: 'B', categoryName: 'Documents / courrier', destinationCity: 'Labé' });
    expect(letter).toContain("J'ai préparé un courrier");
  });
});

describe('ShipmentInvitationsService — recherche de conducteurs', () => {
  it('ville d\'arrivée seule : propose les trajets qui atteignent la ville, arrivée ou ville traversée', async () => {
    const direct = tripRow('t1', 'd1');
    const viaMamou = tripRow('t2', 'd2', { destinationCityId: 'nzerekore', stops: [stop(1, 'labe', 'Labé')] });
    const { service } = build({ trips: [direct, viaMamou, tripRow('t3', 'd3', { destinationCityId: 'siguiri' })] });
    const results = await service.searchDrivers('s1', 'c1', { destinationCityId: 'labe' });
    expect(results.map((r) => r.tripId)).toEqual(['t1', 't2']);
    expect(results[1].viaCityNames).toEqual(['Labé']);
  });

  it('avec une ville de départ : elle doit précéder la ville d\'arrivée sur la route', async () => {
    const kindiaToLabe = tripRow('t1', 'd1', { stops: [stop(1, 'kindia', 'Kindia')] });
    const labeToKindia = tripRow('t2', 'd2', {
      originCityId: 'labe', destinationCityId: 'kindia', stops: [],
    });
    const { service } = build({ trips: [kindiaToLabe, labeToKindia] });
    const results = await service.searchDrivers('s1', 'c1', { originCityId: 'kindia', destinationCityId: 'labe' });
    expect(results.map((r) => r.tripId)).toEqual(['t1']);
  });

  it('un seul trajet par conducteur, et pas de conducteur trop chargé ou hors de la plage de dates', async () => {
    const { service } = build({
      trips: [
        tripRow('t1', 'd1'),
        tripRow('t1b', 'd1', { departureAt: inDays(3) }),
        tripRow('heavy', 'd2', { maxShipmentWeightKg: 2 }),
        tripRow('full', 'd3', { availableShipmentWeightKg: 1 }),
        tripRow('late', 'd4', { departureAt: inDays(30) }),
      ],
    });
    const results = await service.searchDrivers('s1', 'c1', { destinationCityId: 'labe' });
    expect(results.map((r) => r.tripId)).toEqual(['t1']);
  });

  it('signale les conducteurs déjà invités et n\'expose aucune donnée sensible', async () => {
    const { service, prisma } = build({
      trips: [tripRow('t1', 'd1')],
      invitations: [{ driverId: 'd1', status: ShipmentInvitationStatus.DECLINED }],
    });
    const [result] = await service.searchDrivers('s1', 'c1', { destinationCityId: 'labe' });
    expect(result.invitationStatus).toBe('DECLINED');
    // La requête ne demande que des champs publics : ni compte utilisateur, ni Mobile Money, ni banque, ni plaque.
    const include = prisma.trip.findMany.mock.calls[0][0].include;
    expect(Object.keys(include.driver.select).sort()).toEqual(
      ['averageRating', 'completedTripsCount', 'firstName', 'isVerifiedBadge', 'lastName', 'photoUrl', 'ratingsCount'],
    );
    expect(Object.keys(include.vehicle.select).sort()).toEqual(['brand', 'color', 'model']);
  });

  it('refuse un envoi qui n\'est pas au client, ou pas encore payé / déjà pris', async () => {
    await expect(build({ shipment: shipmentRow({ customerId: 'autre' }) }).service.searchDrivers('s1', 'c1', { destinationCityId: 'labe' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(build({ shipment: shipmentRow({ status: ShipmentStatus.CREATED }) }).service.searchDrivers('s1', 'c1', { destinationCityId: 'labe' })).rejects.toBeInstanceOf(ConflictException);
    await expect(build({ shipment: shipmentRow({ windowEnd: inDays(-1) }) }).service.searchDrivers('s1', 'c1', { destinationCityId: 'labe' })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('ShipmentInvitationsService — invitations', () => {
  it('enregistre une invitation par conducteur et le prévient (push + e-mail) avec le message du client', async () => {
    const { service, prisma, notifications } = build({ trips: [tripRow('t1', 'd1'), tripRow('t2', 'd2')] });
    const result = await service.invite('s1', 'c1', ['t1', 't2']);

    expect(result).toEqual({ invited: 2, alreadyInvited: 0, unavailable: 0 });
    expect(prisma.shipmentInvitation.create).toHaveBeenCalledTimes(2);
    expect(notifications.notify).toHaveBeenCalledTimes(2);
    const params = notifications.notify.mock.calls[0][0];
    expect(params.userId).toBe('u-d1');
    expect(params.type).toBe('SHIPMENT_INVITATION');
    expect(params.channels).toEqual(['PUSH', 'EMAIL']);
    expect(params.fallbackBody).toContain('Bonjour Mamadou Barry,');
    expect(params.fallbackBody).toContain('à destination de Labé');
    expect(params.pushData).toEqual({ type: 'SHIPMENT_INVITATION', shipmentId: 's1' });
  });

  it('ne relance pas un conducteur déjà invité, mais rouvre une invitation expirée', async () => {
    const { service, prisma, notifications } = build({
      trips: [tripRow('t1', 'd1'), tripRow('t2', 'd2')],
      invitations: [
        { id: 'i1', driverId: 'd1', status: ShipmentInvitationStatus.PENDING },
        { id: 'i2', driverId: 'd2', status: ShipmentInvitationStatus.EXPIRED },
      ],
    });
    const result = await service.invite('s1', 'c1', ['t1', 't2']);
    expect(result).toEqual({ invited: 1, alreadyInvited: 1, unavailable: 0 });
    expect(prisma.shipmentInvitation.create).not.toHaveBeenCalled();
    expect(prisma.shipmentInvitation.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'i2' }, data: expect.objectContaining({ status: 'PENDING', tripId: 't2' }) }),
    );
    expect(notifications.notify).toHaveBeenCalledTimes(1);
  });

  it('plafonne à 10 invitations en attente par envoi', async () => {
    const pending = Array.from({ length: 9 }, (_, i) => ({ id: `i${i}`, driverId: `x${i}`, status: ShipmentInvitationStatus.PENDING }));
    const { service } = build({ trips: [tripRow('t1', 'd1'), tripRow('t2', 'd2')], invitations: pending });
    await expect(service.invite('s1', 'c1', ['t1', 't2'])).rejects.toBeInstanceOf(BadRequestException);
  });

  it('l\'échec d\'une notification ne défait pas l\'invitation', async () => {
    const { service, prisma, notifications } = build({ trips: [tripRow('t1', 'd1')] });
    notifications.notify.mockRejectedValue(new Error('push indisponible'));
    await expect(service.invite('s1', 'c1', ['t1'])).resolves.toMatchObject({ invited: 1 });
    expect(prisma.shipmentInvitation.create).toHaveBeenCalledTimes(1);
  });

  it('aucun trajet disponible : message clair', async () => {
    const { service } = build({ trips: [] });
    await expect(service.invite('s1', 'c1', ['t1'])).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('ShipmentInvitationsService — réponse du conducteur', () => {
  const pendingInvitation = { id: 'i1', shipmentId: 's1', driverId: 'd1', tripId: 't1', status: ShipmentInvitationStatus.PENDING };

  it('accepter avec le trajet de l\'invitation quand il convient à l\'envoi', async () => {
    const trip = tripRow('t1', 'd1');
    const { service, shipments, prisma } = build({
      invitation: pendingInvitation,
      trips: [trip],
      shipment: { ...shipmentRow(), weightKg: 5 },
    });
    await service.accept('i1', 'u-d1');
    expect(shipments.accept).toHaveBeenCalledWith('s1', 'u-d1', 't1');
    expect(prisma.shipmentInvitation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ACCEPTED' }) }),
    );
  });

  it('accepter sans trajet quand le trajet ne passe pas par les villes de l\'envoi', async () => {
    const trip = tripRow('t1', 'd1', { originCityId: 'mamou', destinationCityId: 'faranah' });
    const { service, shipments } = build({ invitation: pendingInvitation, trips: [trip] });
    await service.accept('i1', 'u-d1');
    expect(shipments.accept).toHaveBeenCalledWith('s1', 'u-d1', undefined);
  });

  it('un autre conducteur a été plus rapide : l\'invitation expire et l\'erreur remonte', async () => {
    const acceptImpl = jest.fn().mockRejectedValue(new ConflictException('déjà pris'));
    const { service, prisma } = build({ invitation: pendingInvitation, trips: [tripRow('t1', 'd1')], acceptImpl });
    await expect(service.accept('i1', 'u-d1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.shipmentInvitation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'EXPIRED' }) }),
    );
  });

  it('une invitation qui n\'est pas à ce conducteur, ou déjà traitée, est refusée', async () => {
    await expect(build({ invitation: { ...pendingInvitation, driverId: 'autre' } }).service.accept('i1', 'u-d1')).rejects.toThrow(/introuvable/);
    await expect(
      build({ invitation: { ...pendingInvitation, status: ShipmentInvitationStatus.DECLINED } }).service.accept('i1', 'u-d1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuser marque l\'invitation et prévient le client par push', async () => {
    const { service, prisma, notifications } = build({ invitation: pendingInvitation });
    prisma.shipment.findUnique.mockResolvedValue({ customer: { userId: 'u-client' } });
    await service.decline('i1', 'u-d1');
    expect(prisma.shipmentInvitation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'DECLINED' }) }),
    );
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u-client', channels: ['PUSH'], pushData: { type: 'SHIPMENT_INVITATION_DECLINED', shipmentId: 's1' } }),
    );
  });
});

describe('effectiveStatus', () => {
  it('une invitation en attente sur un colis pris ou terminé n\'est plus en attente', () => {
    const open = { status: ShipmentStatus.SEARCHING_DRIVER, windowEnd: inDays(2) };
    expect(effectiveStatus(ShipmentInvitationStatus.PENDING, open, 'd1')).toBe('PENDING');
    expect(effectiveStatus(ShipmentInvitationStatus.PENDING, { ...open, status: ShipmentStatus.DRIVER_ASSIGNED, driverId: 'd2' }, 'd1')).toBe('EXPIRED');
    expect(effectiveStatus(ShipmentInvitationStatus.PENDING, { ...open, status: ShipmentStatus.DRIVER_ASSIGNED, driverId: 'd1' }, 'd1')).toBe('ACCEPTED');
    expect(effectiveStatus(ShipmentInvitationStatus.PENDING, { ...open, windowEnd: inDays(-1) }, 'd1')).toBe('EXPIRED');
    expect(effectiveStatus(ShipmentInvitationStatus.DECLINED, open, 'd1')).toBe('DECLINED');
  });
});
