// backend/src/documents/documents.service.evidence.spec.ts
// Preuves d'un envoi ou d'un litige : la clé de stockage doit avoir été fabriquée pour la personne qui l'envoie.
import { BadRequestException } from '@nestjs/common';
import { DocumentsService } from './documents.service';

const UUID = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';

function build(profiles: { driver?: string; customer?: string }) {
  const prisma = {
    driverProfile: { findUnique: jest.fn().mockResolvedValue(profiles.driver ? { id: profiles.driver } : null) },
    customerProfile: { findUnique: jest.fn().mockResolvedValue(profiles.customer ? { id: profiles.customer } : null) },
  };
  return new DocumentsService(prisma as never, {} as never, {} as never);
}

describe('DocumentsService.assertEvidenceKey', () => {
  it('accepte la pièce du conducteur lui-même', async () => {
    await expect(build({ driver: 'drv1' }).assertEvidenceKey('u1', `driver/drv1/${UUID}.jpg`)).resolves.toBeUndefined();
  });

  it('accepte la photo de colis du client lui-même', async () => {
    await expect(build({ customer: 'cus1' }).assertEvidenceKey('u1', `shipment-photo/cus1/${UUID}.png`)).resolves.toBeUndefined();
  });

  it('refuse la clé d’un autre utilisateur', async () => {
    await expect(build({ driver: 'drv1' }).assertEvidenceKey('u1', `driver/drv2/${UUID}.jpg`)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse tout quand la personne n’a aucun profil (personnel)', async () => {
    await expect(build({}).assertEvidenceKey('staff', `driver/drv1/${UUID}.jpg`)).rejects.toBeInstanceOf(BadRequestException);
  });
});
