// backend/src/ratings/ratings.service.given.spec.ts
import { RatingsService } from './ratings.service';

/**
 * "Mes avis" : les notations données par l'utilisateur (fromUserId), pas
 * celles reçues. Le nom affiché vient du profil chauffeur ou client noté
 * (jamais le téléphone ni les coordonnées de paiement), et le contexte
 * distingue un trajet d'un envoi.
 */
function createService(ratings: unknown[]) {
  const prisma = {
    rating: {
      findMany: jest.fn().mockResolvedValue(ratings),
      count: jest.fn().mockResolvedValue(ratings.length),
    },
  };
  const service = new RatingsService(prisma as never);
  return { service, prisma };
}

const tripRating = {
  id: 'r1',
  score: 5,
  createdAt: new Date('2026-09-10'),
  review: { comment: 'Super trajet' },
  toUser: { driverProfile: { firstName: 'Mamadou', lastName: 'Barry', photoUrl: 'https://x/photo.jpg' }, customerProfile: null },
  booking: { trip: { departureAt: new Date('2026-09-10'), originCity: { name: 'Conakry' }, destinationCity: { name: 'Labé' } } },
  shipment: null,
};

const shipmentRating = {
  id: 'r2',
  score: 4,
  createdAt: new Date('2026-09-12'),
  review: null,
  toUser: { driverProfile: { firstName: 'Aïssatou', lastName: 'Diallo', photoUrl: null }, customerProfile: null },
  booking: null,
  shipment: {
    createdAt: new Date('2026-09-12'),
    senderLocation: { city: { name: 'Kindia' } },
    recipientLocation: { city: { name: 'Mamou' } },
  },
};

describe('RatingsService.findGivenByUser', () => {
  it('interroge fromUserId, pas toUserId', async () => {
    const { service, prisma } = createService([]);
    await service.findGivenByUser('u1', { page: 1, limit: 20 } as never);
    expect(prisma.rating.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { fromUserId: 'u1' } }));
  });

  it('transforme une notation de trajet : nom du chauffeur, itinéraire, commentaire', async () => {
    const { service } = createService([tripRating]);
    const result = await service.findGivenByUser('u1', { page: 1, limit: 20 } as never);
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        id: 'r1',
        score: 5,
        comment: 'Super trajet',
        targetName: 'Mamadou Barry',
        targetPhotoUrl: 'https://x/photo.jpg',
        context: { type: 'trip', route: 'Conakry → Labé', date: tripRating.booking.trip.departureAt },
      }),
    );
  });

  it('transforme une notation d’envoi : itinéraire par ville, sans commentaire', async () => {
    const { service } = createService([shipmentRating]);
    const result = await service.findGivenByUser('u1', { page: 1, limit: 20 } as never);
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        comment: null,
        targetName: 'Aïssatou Diallo',
        context: { type: 'shipment', route: 'Kindia → Mamou', date: shipmentRating.shipment.createdAt },
      }),
    );
  });

  it('ne renvoie jamais le profil complet noté (jamais de téléphone ni de coordonnées de paiement)', async () => {
    const { service } = createService([tripRating]);
    const result = await service.findGivenByUser('u1', { page: 1, limit: 20 } as never);
    const serialized = JSON.stringify(result.data[0]);
    expect(serialized).not.toMatch(/phone|mobileMoney|iban/i);
  });
});