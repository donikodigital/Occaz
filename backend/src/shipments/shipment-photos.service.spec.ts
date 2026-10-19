// backend/src/shipments/shipment-photos.service.spec.ts
// Photos du colis : URL d'envoi au nom du client ; lecture réservée à l'expéditeur, au conducteur, au personnel, et aux conducteurs
// validés tant que l'envoi est ouvert ou qu'ils y sont invités.
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ShipmentStatus } from '@prisma/client';
import { ShipmentPhotosService } from './shipment-photos.service';

const user = { id: 'u1', accountType: 'DRIVER', permissions: [], countryScopes: {} } as never;

function build(options: {
  access?: 'ok' | 'forbidden' | 'notfound';
  driverId?: string | null;
  status?: ShipmentStatus;
  invited?: boolean;
  documents?: { id: string; storageKey: string }[];
} = {}) {
  const prisma = {
    document: { findMany: jest.fn().mockResolvedValue(options.documents ?? []) },
    shipment: { findUnique: jest.fn().mockResolvedValue({ status: options.status ?? ShipmentStatus.DRIVER_ASSIGNED }) },
    shipmentInvitation: { findUnique: jest.fn().mockResolvedValue(options.invited ? { id: 'inv1' } : null) },
  };
  const storage = {
    buildKey: jest.fn().mockReturnValue('shipment-photo/c1/00000001-aaaa-bbbb-cccc-dddddddddddd.jpg'),
    createUploadUrl: jest.fn().mockResolvedValue({ uploadUrl: 'https://put', expiresInSeconds: 300 }),
    createDownloadUrl: jest.fn().mockImplementation((key: string) => Promise.resolve(`https://get/${key}`)),
  };
  const customers = { findByUserId: jest.fn().mockResolvedValue({ id: 'c1' }) };
  const access = {
    assertCanAccessEvidence: jest.fn().mockImplementation(() => {
      if (options.access === 'notfound') return Promise.reject(new NotFoundException());
      if (options.access === 'forbidden') return Promise.reject(new ForbiddenException());
      return Promise.resolve();
    }),
  };
  const shipments = {
    requireEligibleDriver: jest.fn().mockImplementation(() => (options.driverId ? Promise.resolve(options.driverId) : Promise.reject(new ForbiddenException()))),
  };
  const service = new ShipmentPhotosService(prisma as never, storage as never, customers as never, access as never, shipments as never);
  return { service, prisma, storage };
}

describe('ShipmentPhotosService.requestUploadUrl', () => {
  it('fabrique une clé au nom du client et renvoie l\'URL signée', async () => {
    const { service, storage } = build();
    const result = await service.requestUploadUrl('u1', { contentType: 'image/jpeg' });
    expect(storage.buildKey).toHaveBeenCalledWith('shipment-photo', 'c1', 'jpg');
    expect(storage.createUploadUrl).toHaveBeenCalledWith(result.storageKey, 'image/jpeg');
    expect(result).toMatchObject({ uploadUrl: 'https://put', expiresInSeconds: 300 });
  });
});

describe('ShipmentPhotosService.list', () => {
  const documents = [{ id: 'd1', storageKey: 'k1' }, { id: 'd2', storageKey: 'k2' }];

  it('renvoie les photos dans l\'ordre, avec des URL signées, pour une personne ayant accès à l\'envoi', async () => {
    const { service, prisma } = build({ documents });
    const photos = await service.list(user, 's1');
    expect(photos).toEqual([
      { id: 'd1', url: 'https://get/k1', expiresInSeconds: 300 },
      { id: 'd2', url: 'https://get/k2', expiresInSeconds: 300 },
    ]);
    expect(prisma.document.findMany.mock.calls[0][0]).toMatchObject({ where: { ownerId: 's1', type: 'parcel_photo', deletedAt: null }, orderBy: { createdAt: 'asc' } });
  });
  it('conducteur validé : voit les photos d\'un envoi ouvert aux candidatures', async () => {
    const { service } = build({ access: 'forbidden', driverId: 'd1', status: ShipmentStatus.SEARCHING_DRIVER, documents });
    await expect(service.list(user, 's1')).resolves.toHaveLength(2);
  });
  it('conducteur validé : voit les photos d\'un envoi où il est invité', async () => {
    const { service } = build({ access: 'forbidden', driverId: 'd1', status: ShipmentStatus.DRIVER_ASSIGNED, invited: true, documents });
    await expect(service.list(user, 's1')).resolves.toHaveLength(2);
  });
  it('conducteur validé sans lien avec un envoi déjà attribué : refusé', async () => {
    const { service, storage } = build({ access: 'forbidden', driverId: 'd1', status: ShipmentStatus.DRIVER_ASSIGNED, documents });
    await expect(service.list(user, 's1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(storage.createDownloadUrl).not.toHaveBeenCalled();
  });
  it('un client étranger ou un conducteur non validé : refusé', async () => {
    const { service } = build({ access: 'forbidden', driverId: null, status: ShipmentStatus.SEARCHING_DRIVER, documents });
    await expect(service.list(user, 's1')).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('envoi inexistant : 404', async () => {
    const { service } = build({ access: 'notfound' });
    await expect(service.list(user, 'nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});
