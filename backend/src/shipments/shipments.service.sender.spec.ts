// backend/src/shipments/shipments.service.sender.spec.ts
// L'expéditeur est le titulaire du compte : son nom et son téléphone viennent du profil, jamais de la requête.
import { BadRequestException } from '@nestjs/common';
import { ShipmentsService } from './shipments.service';

// Ville de ramassage : son pays donne la devise de l'envoi (voir ShipmentsService.buildQuote).
const senderLocation = {
  id: 'loc-a',
  cityId: 'city-a',
  city: { countryId: 'country-1', country: { defaultCurrencyId: 'cur-1' } },
};
const recipientLocation = { id: 'loc-b' };

function build(profile: unknown) {
  const tx = {
    shipment: {
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 's1', ...data })),
      findUnique: jest.fn().mockImplementation(({ where }) => Promise.resolve({ id: where.id })),
    },
    shipmentTracking: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    category: {},
    customerProfile: { findUnique: jest.fn().mockResolvedValue(profile) },
    location: { findUnique: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.id === 'loc-a' ? senderLocation : recipientLocation)) },
    $transaction: jest.fn().mockImplementation((callback: (client: unknown) => unknown) => callback(tx)),
  };
  const categories = { findOne: jest.fn().mockResolvedValue({ id: 'cat1', name: 'Colis', isAllowed: true, priceMultiplier: 1, maxDeclaredValue: null }) };
  const pricing = {
    computeShipmentQuote: jest.fn().mockResolvedValue({ price: 50_000n, distanceKm: 10, chargeableWeightKg: 5, volumetricWeightKg: null }),
    computeCommission: jest.fn().mockResolvedValue(5_000n),
  };
  const service = new ShipmentsService(
    prisma as never, pricing as never, categories as never, {} as never, {} as never,
    { emit: jest.fn() } as never, {} as never, { resolveForCheckout: jest.fn(), redeem: jest.fn() } as never,
  );
  return { service, tx, prisma };
}

const dto = (extra: Record<string, unknown> = {}) =>
  ({
    categoryId: 'cat1', senderLocationId: 'loc-a', recipientLocationId: 'loc-b', weightKg: 2,
    recipientName: 'Aïssatou Bah', recipientPhone: '+224620000002',
    windowStart: new Date(Date.now() + 3_600_000).toISOString(),
    windowEnd: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    ...extra,
  }) as never;

const profile = { firstName: 'Boubacar', lastName: 'BARRY', user: { phone: '+224600000003' } };

describe('ShipmentsService.create — identité de l\'expéditeur', () => {
  it('prend le nom du profil et le téléphone du compte', async () => {
    const { service, tx } = build(profile);
    await service.create('cust1', dto());
    expect(tx.shipment.create.mock.calls[0][0].data).toMatchObject({
      senderName: 'Boubacar BARRY',
      senderPhone: '+224600000003',
    });
  });

  it('ignore un autre nom ou téléphone envoyé dans la requête (client modifié ou ancienne version)', async () => {
    const { service, tx } = build(profile);
    await service.create('cust1', dto({ senderName: 'Quelqu\'un d\'autre', senderPhone: '+221700000000' }));
    const data = tx.shipment.create.mock.calls[0][0].data;
    expect(data.senderName).toBe('Boubacar BARRY');
    expect(data.senderPhone).toBe('+224600000003');
  });

  it('l\'adresse de récupération reste celle choisie par le client', async () => {
    const { service, tx } = build(profile);
    await service.create('cust1', dto());
    expect(tx.shipment.create.mock.calls[0][0].data.senderLocationId).toBe('loc-a');
  });

  it('refuse l\'envoi si le profil est introuvable ou sans nom', async () => {
    await expect(build(null).service.create('cust1', dto())).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      build({ firstName: '', lastName: '', user: { phone: '+224600000003' } }).service.create('cust1', dto()),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse l\'envoi si le compte n\'a pas de téléphone', async () => {
    await expect(
      build({ firstName: 'A', lastName: 'Bah', user: { phone: null } }).service.create('cust1', dto()),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse avant tout calcul ou écriture : rien n\'est créé', async () => {
    const { service, tx } = build(null);
    await expect(service.create('cust1', dto())).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.shipment.create).not.toHaveBeenCalled();
  });
});
