// backend/src/common/scope/country-scope.service.spec.ts
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AccountType, DocumentOwnerType } from '@prisma/client';
import { PERMISSIONS } from '../constants/permissions.constants';
import { CountryScopeService } from './country-scope.service';

function build(overrides: Record<string, unknown> = {}) {
  const prisma = {
    dispute: { count: jest.fn(), findUnique: jest.fn() },
    user: { count: jest.fn() },
    driverProfile: { count: jest.fn() },
    conversation: { count: jest.fn() },
    document: { findUnique: jest.fn() },
    country: { findMany: jest.fn() },
    ...overrides,
  };
  return { service: new CountryScopeService(prisma as never), prisma };
}

const scopedSupport = {
  accountType: AccountType.SUPPORT,
  permissions: [PERMISSIONS.DISPUTE_READ, PERMISSIONS.CONVERSATION_READ, PERMISSIONS.DOCUMENT_READ],
  scopedCountryIds: ['GN'],
  countryScopes: {
    [PERMISSIONS.DISPUTE_READ]: ['GN'],
    [PERMISSIONS.CONVERSATION_READ]: ['GN'],
    [PERMISSIONS.DOCUMENT_READ]: ['GN'],
  },
};
const globalSupport = { ...scopedSupport, scopedCountryIds: [], countryScopes: {} };
const superAdmin = { ...scopedSupport, accountType: AccountType.SUPERADMIN };

describe('CountryScopeService', () => {
  describe('assertDispute', () => {
    it('ne fait aucune requête et laisse passer un compte sans portée', async () => {
      const { service, prisma } = build();
      await expect(service.assertDispute(globalSupport, PERMISSIONS.DISPUTE_READ, 'd1')).resolves.toBeUndefined();
      expect(prisma.dispute.count).not.toHaveBeenCalled();
    });

    it('laisse passer un SuperAdmin même s\'il porte une table de portées', async () => {
      const { service, prisma } = build();
      await service.assertDispute(superAdmin, PERMISSIONS.DISPUTE_READ, 'd1');
      expect(prisma.dispute.count).not.toHaveBeenCalled();
    });

    it('laisse passer un litige du périmètre', async () => {
      const { service, prisma } = build();
      prisma.dispute.count.mockResolvedValue(1);
      await expect(service.assertDispute(scopedSupport, PERMISSIONS.DISPUTE_READ, 'd1')).resolves.toBeUndefined();
      expect(prisma.dispute.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: 'd1' }) }),
      );
    });

    it('répond 404 (et non 403) pour un litige hors périmètre', async () => {
      const { service, prisma } = build();
      prisma.dispute.count.mockResolvedValue(0);
      await expect(service.assertDispute(scopedSupport, PERMISSIONS.DISPUTE_READ, 'd2')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('assertUser', () => {
    it('accepte toujours un compte d\'équipe, refuse un client hors pays', async () => {
      const { service, prisma } = build();
      prisma.user.count.mockResolvedValue(0);
      await expect(service.assertUser(scopedSupport, PERMISSIONS.DISPUTE_READ, 'u1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      const where = prisma.user.count.mock.calls[0][0].where;
      expect(where.OR[0]).toEqual({ accountType: { in: [AccountType.SUPPORT, AccountType.SUPERADMIN] } });
    });
  });

  describe('hasDisputeAccess', () => {
    it('faux sans la permission de lecture', async () => {
      const { service } = build();
      expect(await service.hasDisputeAccess({ ...scopedSupport, permissions: [] }, 'd1')).toBe(false);
    });
    it('vrai sans portée (aucune requête)', async () => {
      const { service, prisma } = build();
      expect(await service.hasDisputeAccess(globalSupport, 'd1')).toBe(true);
      expect(prisma.dispute.count).not.toHaveBeenCalled();
    });
    it('dépend du périmètre quand l\'agent est limité', async () => {
      const { service, prisma } = build();
      prisma.dispute.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
      expect(await service.hasDisputeAccess(scopedSupport, 'dans')).toBe(true);
      expect(await service.hasDisputeAccess(scopedSupport, 'hors')).toBe(false);
    });
  });

  describe('hasConversationAccess', () => {
    it('suit le périmètre de la conversation', async () => {
      const { service, prisma } = build();
      prisma.conversation.count.mockResolvedValue(0);
      expect(await service.hasConversationAccess(scopedSupport, 'c1')).toBe(false);
      prisma.conversation.count.mockResolvedValue(1);
      expect(await service.hasConversationAccess(scopedSupport, 'c1')).toBe(true);
    });
  });

  describe('documents', () => {
    it('une liste sans propriétaire est refusée à un agent limité (400)', async () => {
      const { service } = build();
      await expect(
        service.assertDocumentListAllowed(scopedSupport, PERMISSIONS.DOCUMENT_READ, {}),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('une liste sans propriétaire reste permise sans portée', async () => {
      const { service } = build();
      await expect(
        service.assertDocumentListAllowed(globalSupport, PERMISSIONS.DOCUMENT_READ, {}),
      ).resolves.toBeUndefined();
    });

    it('un document dont le conducteur propriétaire est hors pays est introuvable', async () => {
      const { service, prisma } = build();
      prisma.document.findUnique.mockResolvedValue({ ownerType: DocumentOwnerType.DRIVER, ownerId: 'dr1' });
      prisma.driverProfile.count.mockResolvedValue(0);
      await expect(service.assertDocument(scopedSupport, PERMISSIONS.DOCUMENT_READ, 'doc1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('filterDocuments ne garde que les documents du périmètre et mémorise chaque propriétaire', async () => {
      const { service, prisma } = build();
      prisma.driverProfile.count.mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve(where.id === 'dans' ? 1 : 0),
      );
      const docs = [
        { id: 'a', ownerType: DocumentOwnerType.DRIVER, ownerId: 'dans' },
        { id: 'b', ownerType: DocumentOwnerType.DRIVER, ownerId: 'hors' },
        { id: 'c', ownerType: DocumentOwnerType.DRIVER, ownerId: 'dans' },
      ];
      const result = await service.filterDocuments(scopedSupport, PERMISSIONS.DOCUMENT_READ, docs);
      expect(result.map((d) => d.id)).toEqual(['a', 'c']);
      expect(prisma.driverProfile.count).toHaveBeenCalledTimes(2); // 'dans' n'est interrogé qu'une fois
    });

    it('filterDocuments renvoie tout sans portée', async () => {
      const { service } = build();
      const docs = [{ ownerType: DocumentOwnerType.DRIVER, ownerId: 'x' }];
      expect(await service.filterDocuments(globalSupport, PERMISSIONS.DOCUMENT_READ, docs)).toBe(docs);
    });
  });

  describe('countriesOfDispute', () => {
    it('collecte tous les pays des parties, du trajet et des adresses, sans doublon', async () => {
      const { service, prisma } = build();
      prisma.dispute.findUnique.mockResolvedValue({
        booking: {
          customer: { countryId: 'GN', city: { countryId: 'GN' } },
          trip: { originCity: { countryId: 'GN' }, destinationCity: { countryId: 'SN' }, driver: { countryId: 'ML' } },
        },
        shipment: null,
      });
      const countries = await service.countriesOfDispute('d1');
      expect(countries.sort()).toEqual(['GN', 'ML', 'SN']);
    });

    it('renvoie une liste vide si le litige n\'existe pas', async () => {
      const { service, prisma } = build();
      prisma.dispute.findUnique.mockResolvedValue(null);
      expect(await service.countriesOfDispute('x')).toEqual([]);
    });
  });

  describe('describeScope', () => {
    it('liste les pays de l\'agent limité', async () => {
      const { service, prisma } = build();
      prisma.country.findMany.mockResolvedValue([{ id: 'GN', name: 'Guinée' }]);
      expect(await service.describeScope(scopedSupport)).toEqual([{ id: 'GN', name: 'Guinée' }]);
    });
    it('renvoie une liste vide sans portée et pour un SuperAdmin (aucune requête)', async () => {
      const { service, prisma } = build();
      expect(await service.describeScope(globalSupport)).toEqual([]);
      expect(await service.describeScope(superAdmin)).toEqual([]);
      expect(prisma.country.findMany).not.toHaveBeenCalled();
    });
  });
});