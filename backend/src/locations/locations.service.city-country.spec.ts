// backend/src/locations/locations.service.city-country.spec.ts
// Chaque adresse renvoyée porte sa ville ET le pays de cette ville : l'app affiche « Kindia, Guinée » sous le libellé.
import { LocationsService } from './locations.service';

const CITY = { id: 'kindia', name: 'Kindia', country: { id: 'gn', name: 'Guinée', isoCode: 'GN' } };

function build() {
  const prisma = {
    location: {
      create: jest.fn().mockResolvedValue({ id: 'l1', label: 'Station service Total', cityId: 'kindia', city: CITY }),
      findUnique: jest.fn().mockResolvedValue({ id: 'l1', label: 'Station service Total', cityId: 'kindia', city: CITY }),
      update: jest.fn().mockResolvedValue({ id: 'l1', city: CITY }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    savedLocation: {
      findMany: jest.fn().mockResolvedValue([
        {
          usageCount: 3,
          lastUsedAt: new Date('2026-10-01T00:00:00Z'),
          location: {
            id: 'l1', label: 'Station service Total', formattedAddress: null, latitude: 10.05, longitude: -12.86,
            cityId: 'kindia', city: CITY,
          },
        },
        {
          usageCount: 1,
          lastUsedAt: new Date('2026-09-01T00:00:00Z'),
          location: { id: 'l2', label: 'Chez moi', formattedAddress: null, latitude: null, longitude: null, cityId: null, city: null },
        },
      ]),
    },
    $executeRaw: jest.fn().mockResolvedValue(1),
  };
  return { service: new LocationsService(prisma as never), prisma };
}

const includesCountry = (args: { include?: { city?: { select?: { country?: unknown } } } }) =>
  Boolean(args.include?.city?.select?.country);

describe('LocationsService — ville et pays avec chaque adresse', () => {
  it('create demande la ville et son pays', async () => {
    const { service, prisma } = build();
    const location = await service.create({ label: 'Station service Total', cityId: 'kindia' } as never);
    expect(includesCountry(prisma.location.create.mock.calls[0][0])).toBe(true);
    expect(location.city?.country.name).toBe('Guinée');
  });

  it('findOne demande la ville et son pays', async () => {
    const { service, prisma } = build();
    await service.findOne('l1');
    expect(includesCountry(prisma.location.findUnique.mock.calls[0][0])).toBe(true);
  });

  it('update demande la ville et son pays', async () => {
    const { service, prisma } = build();
    await service.update('l1', { label: 'Autre' } as never);
    expect(includesCountry(prisma.location.update.mock.calls[0][0])).toBe(true);
  });

  it('adresses mémorisées : ville et pays renvoyés, cityName conservé pour les anciennes versions de l\'app', async () => {
    const { service, prisma } = build();
    const rows = await service.findSaved('u1', {} as never);
    expect(prisma.savedLocation.findMany.mock.calls[0][0].include.location.include.city.select.country).toBeTruthy();
    expect(rows[0]).toMatchObject({ id: 'l1', cityName: 'Kindia', city: CITY });
    // une adresse sans ville reste valide : city = null, l'app n'affiche alors que le libellé
    expect(rows[1]).toMatchObject({ id: 'l2', cityName: null, city: null });
  });
});
