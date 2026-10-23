// backend/src/documents/documents.service.spec.ts
// Suppression d'une pièce par son propriétaire : refusée si elle est déjà vérifiée, emporte les anciens envois non vérifiés du même type,
// et n'efface le fichier du stockage que s'il ne sert plus de justificatif.
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DocumentOwnerType, DocumentStatus } from '@prisma/client';
import { DocumentsService } from './documents.service';

type Row = { id: string; storageKey: string };

function build(options: { found?: Record<string, unknown> | null; siblings?: Row[]; verifications?: number; evidence?: number } = {}) {
  const found = options.found === undefined ? { id: 'doc2', type: 'driver_license', status: DocumentStatus.PENDING } : options.found;
  const prisma = {
    document: {
      findFirst: jest.fn().mockResolvedValue(found),
      findMany: jest.fn().mockResolvedValue(options.siblings ?? [{ id: 'doc2', storageKey: 'k2' }]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    verification: { count: jest.fn().mockResolvedValue(options.verifications ?? 0) },
    disputeEvidence: { count: jest.fn().mockResolvedValue(options.evidence ?? 0) },
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const storage = { deleteObject: jest.fn().mockResolvedValue(undefined) };
  const service = new DocumentsService(prisma as never, audit as never, storage as never);
  return { service, prisma, audit, storage };
}

describe('DocumentsService.removeOwned', () => {
  it('ne cherche que dans les pièces du propriétaire, non supprimées', async () => {
    const { service, prisma } = build();
    await service.removeOwned(DocumentOwnerType.DRIVER, 'drv', 'doc2', 'user');
    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: { id: 'doc2', ownerType: DocumentOwnerType.DRIVER, ownerId: 'drv', deletedAt: null },
    });
  });

  it('une pièce introuvable (ou d’un autre propriétaire) donne une 404', async () => {
    const { service, prisma } = build({ found: null });
    await expect(service.removeOwned(DocumentOwnerType.DRIVER, 'drv', 'doc2', 'user')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.document.updateMany).not.toHaveBeenCalled();
  });

  it('une pièce déjà vérifiée ne se supprime pas', async () => {
    const { service, prisma, storage } = build({ found: { id: 'doc2', type: 'driver_license', status: DocumentStatus.VERIFIED } });
    await expect(service.removeOwned(DocumentOwnerType.DRIVER, 'drv', 'doc2', 'user')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.document.updateMany).not.toHaveBeenCalled();
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('emporte les autres envois non vérifiés du même type, et efface leurs fichiers', async () => {
    const { service, prisma, storage, audit } = build({
      siblings: [
        { id: 'doc2', storageKey: 'k2' },
        { id: 'doc1', storageKey: 'k1' },
      ],
    });
    const result = await service.removeOwned(DocumentOwnerType.DRIVER, 'drv', 'doc2', 'user');
    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerType: DocumentOwnerType.DRIVER, ownerId: 'drv', type: 'driver_license', deletedAt: null, status: { not: DocumentStatus.VERIFIED } },
      }),
    );
    expect(prisma.document.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['doc2', 'doc1'] } }, data: { deletedAt: expect.any(Date) } });
    expect(storage.deleteObject).toHaveBeenCalledWith('k2');
    expect(storage.deleteObject).toHaveBeenCalledWith('k1');
    expect(result).toEqual({ deleted: 2 });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'Document', entityId: 'doc2', action: 'DELETE' }));
  });

  it('garde le fichier s’il sert encore de justificatif (vérification ou litige)', async () => {
    const withVerification = build({ verifications: 1 });
    await withVerification.service.removeOwned(DocumentOwnerType.DRIVER, 'drv', 'doc2', 'user');
    expect(withVerification.storage.deleteObject).not.toHaveBeenCalled();
    expect(withVerification.prisma.document.updateMany).toHaveBeenCalled();

    const withEvidence = build({ evidence: 1 });
    await withEvidence.service.removeOwned(DocumentOwnerType.VEHICLE, 'veh', 'doc2', 'user');
    expect(withEvidence.storage.deleteObject).not.toHaveBeenCalled();
  });
});
