// backend/src/company-documents/company-documents.service.spec.ts
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AccountType, Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { CompanyDocumentsService } from './company-documents.service';

const UUID = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';
const user = (id: string, accountType: AccountType = AccountType.SUPPORT): AuthenticatedUser =>
  ({ id, phone: '+224620000000', accountType, sessionId: 's', permissions: [], scopedCountryIds: [], countryScopes: {} }) as AuthenticatedUser;
const agent = user('agent');
const other = user('other');
const admin = user('admin', AccountType.SUPERADMIN);

function row(extra: Record<string, unknown> = {}) {
  return {
    id: 'doc1',
    title: 'PV octobre',
    category: 'MEETING_MINUTES',
    description: null,
    documentDate: new Date('2026-10-12T00:00:00Z'),
    fileName: 'pv.pdf',
    contentType: 'application/pdf',
    sizeBytes: 1000,
    storageKey: `company-document/agent/${UUID}.pdf`,
    restricted: false,
    uploadedById: 'agent',
    uploadedBy: { id: 'agent', email: 'agent@occaz.sarl', phone: '+224620000000', staffProfile: { firstName: 'Awa', lastName: 'Bah' } },
    createdAt: new Date('2026-10-12T10:00:00Z'),
    updatedAt: new Date('2026-10-12T10:00:00Z'),
    ...extra,
  };
}

function build() {
  const prisma = {
    companyDocument: {
      findMany: jest.fn().mockResolvedValue([row()]),
      count: jest.fn().mockResolvedValue(1),
      groupBy: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(row()),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve(row({ ...data, id: 'new' }))),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve(row(data))),
      delete: jest.fn().mockResolvedValue({}),
    },
  };
  const storage = {
    buildKey: jest.fn().mockImplementation((folder: string, owner: string, ext: string) => `${folder}/${owner}/${UUID}.${ext}`),
    createUploadUrl: jest.fn().mockResolvedValue({ uploadUrl: 'https://r2/put', expiresInSeconds: 300 }),
    createDownloadUrl: jest.fn().mockResolvedValue('https://r2/get'),
    headObject: jest.fn().mockResolvedValue({ size: 2048, contentType: 'application/pdf' }),
    deleteObject: jest.fn().mockResolvedValue(undefined),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const service = new CompanyDocumentsService(prisma as never, storage as never, audit as never);
  return { service, prisma, storage, audit };
}

const createDto = (extra: Record<string, unknown> = {}) => ({
  title: '  PV   de la réunion ',
  category: 'MEETING_MINUTES' as const,
  storageKey: `company-document/agent/${UUID}.pdf`,
  fileName: 'C:\\scans\\pv.pdf',
  contentType: 'application/pdf' as const,
  ...extra,
});

describe('CompanyDocumentsService — envoi', () => {
  it('fabrique une clé pour le compte qui dépose et signe le lien d’envoi', async () => {
    const { service, storage } = build();
    const result = await service.requestUpload({ contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sizeBytes: 5000 }, agent);
    expect(storage.buildKey).toHaveBeenCalledWith('company-document', 'agent', 'docx');
    expect(result).toMatchObject({ uploadUrl: 'https://r2/put', storageKey: `company-document/agent/${UUID}.docx`, maxBytes: 25 * 1024 * 1024 });
  });

  it('crée la fiche avec la taille réelle du stockage et un nom nettoyé, puis journalise', async () => {
    const { service, prisma, audit } = build();
    const view = await service.create(createDto({ description: ' ordre du jour ', restricted: true }), agent);
    expect(prisma.companyDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: 'PV de la réunion', sizeBytes: 2048, fileName: 'pv.pdf', restricted: true, uploadedById: 'agent', description: 'ordre du jour' }),
      }),
    );
    expect(view.canChange).toBe(true);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'CREATED', actorId: 'agent' }));
  });

  it('refuse la clé d’un autre compte', async () => {
    const { service, prisma } = build();
    await expect(service.create(createDto({ storageKey: `company-document/other/${UUID}.pdf` }), agent)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.companyDocument.create).not.toHaveBeenCalled();
  });

  it('refuse une clé dont l’extension ne correspond pas au type annoncé', async () => {
    const { service } = build();
    await expect(service.create(createDto({ storageKey: `company-document/agent/${UUID}.docx` }), agent)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse un fichier absent du stockage', async () => {
    const { service, storage, prisma } = build();
    storage.headObject.mockResolvedValue(null);
    await expect(service.create(createDto(), agent)).rejects.toThrow(/n'est pas arrivé/);
    expect(prisma.companyDocument.create).not.toHaveBeenCalled();
  });

  it('refuse (et efface) un fichier trop gros, malgré la taille annoncée', async () => {
    const { service, storage } = build();
    storage.headObject.mockResolvedValue({ size: 26 * 1024 * 1024, contentType: 'application/pdf' });
    await expect(service.create(createDto(), agent)).rejects.toThrow(/25 Mo/);
    expect(storage.deleteObject).toHaveBeenCalled();
  });

  it('refuse (et efface) un fichier envoyé avec un autre type que celui annoncé', async () => {
    const { service, storage } = build();
    storage.headObject.mockResolvedValue({ size: 100, contentType: 'text/html' });
    await expect(service.create(createDto(), agent)).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.deleteObject).toHaveBeenCalled();
  });

  it('refuse un titre vide et une date impossible', async () => {
    const { service } = build();
    await expect(service.create(createDto({ title: '   ' }), agent)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(createDto({ documentDate: '2026-02-31' }), agent)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('signale un fichier déjà enregistré (confirmation rejouée)', async () => {
    const { service, prisma } = build();
    prisma.companyDocument.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }));
    await expect(service.create(createDto(), agent)).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('CompanyDocumentsService — lecture', () => {
  it('la liste applique le filtre de visibilité du compte, la catégorie et la recherche', async () => {
    const { service, prisma } = build();
    await service.list({ page: 1, limit: 20, skip: 0, take: 20, category: 'LEGAL', search: ' statuts ' } as never, other);
    const where = prisma.companyDocument.findMany.mock.calls[0][0].where;
    expect(where.AND[0]).toEqual({ OR: [{ restricted: false }, { uploadedById: 'other' }] });
    expect(where.AND[1]).toEqual({ category: 'LEGAL' });
    expect(JSON.stringify(where.AND[2])).toContain('statuts');
  });

  it('le SuperAdmin ne subit aucun filtre de visibilité', async () => {
    const { service, prisma } = build();
    await service.list({ page: 1, limit: 20, skip: 0, take: 20 } as never, admin);
    expect(prisma.companyDocument.findMany.mock.calls[0][0].where.AND[0]).toEqual({});
  });

  it('présente le nom de la personne qui a déposé et le droit de modifier', async () => {
    const { service } = build();
    const asOther = await service.list({ page: 1, limit: 20, skip: 0, take: 20 } as never, other);
    expect(asOther.data[0]).toMatchObject({ uploadedByName: 'Awa Bah', canChange: false, documentDate: '2026-10-12', opensInBrowser: true });
    const asAgent = await service.list({ page: 1, limit: 20, skip: 0, take: 20 } as never, agent);
    expect(asAgent.data[0].canChange).toBe(true);
  });

  it('les statistiques comptent par catégorie, toutes catégories présentes', async () => {
    const { service, prisma } = build();
    prisma.companyDocument.groupBy.mockResolvedValue([
      { category: 'MEETING_MINUTES', _count: { _all: 3 }, _sum: { sizeBytes: 3000 } },
      { category: 'LEGAL', _count: { _all: 1 }, _sum: { sizeBytes: 500 } },
    ]);
    const stats = await service.stats(agent);
    expect(stats).toMatchObject({ total: 4, totalBytes: 3500 });
    expect(stats.byCategory).toMatchObject({ MEETING_MINUTES: 3, LEGAL: 1, CONTRACT: 0, OTHER: 0 });
  });

  it('un document réservé est introuvable pour un autre compte (pas de fuite d’existence)', async () => {
    const { service, prisma } = build();
    prisma.companyDocument.findUnique.mockResolvedValue(row({ restricted: true }));
    await expect(service.link('doc1', {}, other)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update('doc1', { title: 'x' }, other)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove('doc1', other)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('le lien ouvre un PDF dans le navigateur et enregistre un fichier Word, avec le bon nom, et journalise', async () => {
    const { service, prisma, storage, audit } = build();
    const pdf = await service.link('doc1', {}, other);
    expect(pdf.mode).toBe('open');
    expect(storage.createDownloadUrl.mock.calls[0][1].contentDisposition).toMatch(/^inline; filename="pv.pdf"/);
    expect(audit.log).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'OPENED', actorId: 'other' }));

    prisma.companyDocument.findUnique.mockResolvedValue(row({ contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', fileName: 'pv.docx' }));
    const word = await service.link('doc1', {}, other);
    expect(word.mode).toBe('download');
    expect(storage.createDownloadUrl.mock.calls[1][1].contentDisposition).toMatch(/^attachment;/);

    prisma.companyDocument.findUnique.mockResolvedValue(row());
    const forced = await service.link('doc1', { mode: 'download' }, other);
    expect(forced.mode).toBe('download');
  });
});

describe('CompanyDocumentsService — modifier et supprimer', () => {
  it('un autre compte ne peut ni modifier ni supprimer le document d’un collègue', async () => {
    const { service, prisma } = build();
    await expect(service.update('doc1', { title: 'x' }, other)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.remove('doc1', other)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.companyDocument.update).not.toHaveBeenCalled();
    expect(prisma.companyDocument.delete).not.toHaveBeenCalled();
  });

  it('le dépositaire et le SuperAdmin peuvent modifier ; seuls les champs changés sont écrits et journalisés', async () => {
    const { service, prisma, audit } = build();
    await service.update('doc1', { title: 'PV octobre', category: 'LEGAL', documentDate: '', description: '  notes ', restricted: true }, agent);
    expect(prisma.companyDocument.update.mock.calls[0][0].data).toEqual({ category: 'LEGAL', documentDate: null, description: 'notes', restricted: true });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'UPDATED' }));

    await service.update('doc1', { title: 'Nouveau titre' }, admin);
    expect(prisma.companyDocument.update.mock.calls[1][0].data).toEqual({ title: 'Nouveau titre' });
  });

  it('ne fait rien (ni écriture ni journal) quand rien ne change', async () => {
    const { service, prisma, audit } = build();
    await service.update('doc1', { title: 'PV octobre', restricted: false }, agent);
    expect(prisma.companyDocument.update).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('refuse un titre vide et une date impossible à la modification', async () => {
    const { service } = build();
    await expect(service.update('doc1', { title: '  ' }, agent)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update('doc1', { documentDate: '2026-13-01' }, agent)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('supprime la fiche puis le fichier, et journalise', async () => {
    const { service, prisma, storage, audit } = build();
    await expect(service.remove('doc1', agent)).resolves.toEqual({ deleted: true });
    expect(prisma.companyDocument.delete).toHaveBeenCalledWith({ where: { id: 'doc1' } });
    expect(storage.deleteObject).toHaveBeenCalledWith(`company-document/agent/${UUID}.pdf`);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'DELETED' }));
  });

  it('un document inexistant est introuvable', async () => {
    const { service, prisma } = build();
    prisma.companyDocument.findUnique.mockResolvedValue(null);
    await expect(service.remove('nope', admin)).rejects.toBeInstanceOf(NotFoundException);
  });
});
