// backend/src/trips/trips.service.getPosition.spec.ts
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TripsService } from './trips.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Seul `prisma` est réellement sollicité par getPosition — les 6 autres
 * dépendances de TripsService sont de simples stubs vides, jamais
 * appelés par le chemin de code testé ici.
 */
function createService(trip: unknown, activeBooking: unknown = null) {
  const prisma = {
    trip: { findUnique: jest.fn().mockResolvedValue(trip) },
    booking: { findFirst: jest.fn().mockResolvedValue(activeBooking) },
  } as unknown as PrismaService;

  const stub = {} as any;
  return new TripsService(prisma, stub, stub, stub, stub, stub, stub);
}

describe('TripsService.getPosition', () => {
  const tripWithPosition = {
    id: 'trip-1',
    driverId: 'driver-1',
    currentLatitude: 9.641,
    currentLongitude: -13.578,
    currentPositionUpdatedAt: new Date('2026-01-01T10:00:00.000Z'),
  };

  it('lève une exception si le trajet est introuvable', async () => {
    const service = createService(null);
    await expect(
      service.getPosition('missing-trip', { driverProfileId: 'driver-1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('autorise le chauffeur propriétaire du trajet', async () => {
    const service = createService(tripWithPosition);
    const result = await service.getPosition('trip-1', { driverProfileId: 'driver-1' });
    expect(result).toEqual({ latitude: 9.641, longitude: -13.578, updatedAt: tripWithPosition.currentPositionUpdatedAt });
  });

  it("rejette un autre chauffeur (pas le sien) — c'est la vérification de sécurité la plus importante ici", async () => {
    const service = createService(tripWithPosition);
    await expect(
      service.getPosition('trip-1', { driverProfileId: 'un-autre-chauffeur' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('autorise un client avec une réservation active (PAID/CONFIRMED) sur ce trajet', async () => {
    const service = createService(tripWithPosition, { id: 'booking-1', status: 'CONFIRMED' });
    const result = await service.getPosition('trip-1', { customerProfileId: 'customer-1' });
    expect(result).not.toBeNull();
  });

  it("rejette un client sans réservation active sur ce trajet (aucune trouvée par la requête)", async () => {
    const service = createService(tripWithPosition, null);
    await expect(
      service.getPosition('trip-1', { customerProfileId: 'customer-sans-reservation' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejette un appelant qui n'est ni le chauffeur ni un client (aucun identifiant fourni)", async () => {
    const service = createService(tripWithPosition);
    await expect(service.getPosition('trip-1', {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("renvoie null si le trajet n'a encore aucune position (pas démarré ou pas encore de mise à jour reçue)", async () => {
    const service = createService({
      id: 'trip-1',
      driverId: 'driver-1',
      currentLatitude: null,
      currentLongitude: null,
      currentPositionUpdatedAt: null,
    });
    const result = await service.getPosition('trip-1', { driverProfileId: 'driver-1' });
    expect(result).toBeNull();
  });
});
