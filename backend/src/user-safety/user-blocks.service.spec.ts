// backend/src/user-safety/user-blocks.service.spec.ts
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AccountType } from '@prisma/client';
import { UserBlocksService } from './user-blocks.service';

function build(overrides: Record<string, unknown> = {}) {
  const prisma = {
    user: { findFirst: jest.fn().mockResolvedValue({ id: 'u2', accountType: AccountType.DRIVER }) },
    userBlock: {
      upsert: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    driverProfile: { findUnique: jest.fn() },
    customerProfile: { findUnique: jest.fn() },
    trip: { findUnique: jest.fn(), findMany: jest.fn() },
    shipment: { findUnique: jest.fn() },
    shipmentInvitation: { findUnique: jest.fn() },
    conversation: { findUnique: jest.fn() },
    ...overrides,
  };
  return { service: new UserBlocksService(prisma as never), prisma };
}

describe('UserBlocksService.block', () => {
  it('bloque un conducteur (création idempotente)', async () => {
    const { service, prisma } = build();
    await expect(service.block('u1', 'u2')).resolves.toEqual({ blocked: true });
    expect(prisma.userBlock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { blockerId_blockedId: { blockerId: 'u1', blockedId: 'u2' } } }),
    );
  });

  it('refuse de se bloquer soi-même', async () => {
    const { service } = build();
    await expect(service.block('u1', 'u1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse un utilisateur introuvable', async () => {
    const { service } = build({ user: { findFirst: jest.fn().mockResolvedValue(null) } });
    await expect(service.block('u1', 'u2')).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([AccountType.SUPPORT, AccountType.SUPERADMIN])('refuse de bloquer un compte %s', async (accountType) => {
    const { service } = build({ user: { findFirst: jest.fn().mockResolvedValue({ id: 'u2', accountType }) } });
    await expect(service.block('u1', 'u2')).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('UserBlocksService.resolveTargetUserId', () => {
  it('garde un identifiant de compte tel quel', async () => {
    const { service } = build();
    await expect(service.resolveTargetUserId({ userId: 'u9' })).resolves.toBe('u9');
  });

  it('retrouve le compte d’un conducteur ou d’un client à partir de son profil', async () => {
    const { service, prisma } = build();
    prisma.driverProfile.findUnique.mockResolvedValue({ userId: 'ud' });
    prisma.customerProfile.findUnique.mockResolvedValue({ userId: 'uc' });
    await expect(service.resolveTargetUserId({ driverId: 'd1' })).resolves.toBe('ud');
    await expect(service.resolveTargetUserId({ customerId: 'c1' })).resolves.toBe('uc');
  });

  it('exige exactement une référence', async () => {
    const { service } = build();
    await expect(service.resolveTargetUserId({})).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.resolveTargetUserId({ userId: 'a', driverId: 'b' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('profil inconnu : 404', async () => {
    const { service, prisma } = build();
    prisma.driverProfile.findUnique.mockResolvedValue(null);
    await expect(service.resolveTargetUserId({ driverId: 'nope' })).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('UserBlocksService — blocage dans les deux sens', () => {
  it('isBlockedBetween interroge les deux sens', async () => {
    const { service, prisma } = build();
    prisma.userBlock.count.mockResolvedValue(1);
    await expect(service.isBlockedBetween('a', 'b')).resolves.toBe(true);
    expect(prisma.userBlock.count).toHaveBeenCalledWith({
      where: { OR: [{ blockerId: 'a', blockedId: 'b' }, { blockerId: 'b', blockedId: 'a' }] },
    });
  });

  it('un compte n’est jamais bloqué vis-à-vis de lui-même', async () => {
    const { service, prisma } = build();
    await expect(service.isBlockedBetween('a', 'a')).resolves.toBe(false);
    expect(prisma.userBlock.count).not.toHaveBeenCalled();
  });

  it('assertCanBookTrip refuse sans dire qui a bloqué', async () => {
    const { service, prisma } = build();
    prisma.trip.findUnique.mockResolvedValue({ driver: { userId: 'driver1' } });
    prisma.userBlock.count.mockResolvedValue(1);
    await expect(service.assertCanBookTrip('cust1', 't1')).rejects.toThrow("Cette action n'est pas possible avec cet utilisateur.");
  });

  it('assertCanBookTrip laisse passer quand personne n’a bloqué', async () => {
    const { service, prisma } = build();
    prisma.trip.findUnique.mockResolvedValue({ driver: { userId: 'driver1' } });
    await expect(service.assertCanBookTrip('cust1', 't1')).resolves.toBeUndefined();
  });

  it('assertCanBookTrip laisse le service répondre 404 si le trajet n’existe pas', async () => {
    const { service, prisma } = build();
    prisma.trip.findUnique.mockResolvedValue(null);
    await expect(service.assertCanBookTrip('cust1', 'nope')).resolves.toBeUndefined();
  });
});

describe('UserBlocksService.filterTripIdsForCustomer', () => {
  it('ne touche à rien sans aucun blocage', async () => {
    const { service, prisma } = build();
    await expect(service.filterTripIdsForCustomer('cust1', ['t1', 't2'])).resolves.toEqual(['t1', 't2']);
    expect(prisma.trip.findMany).not.toHaveBeenCalled();
  });

  it('retire les trajets d’un conducteur bloqué par le client ET ceux d’un conducteur qui a bloqué le client', async () => {
    const { service, prisma } = build();
    prisma.userBlock.findMany.mockResolvedValue([
      { blockerId: 'cust1', blockedId: 'driverA' },
      { blockerId: 'driverB', blockedId: 'cust1' },
    ]);
    prisma.trip.findMany.mockResolvedValue([
      { id: 't1', driver: { userId: 'driverA' } },
      { id: 't2', driver: { userId: 'driverB' } },
      { id: 't3', driver: { userId: 'driverC' } },
    ]);
    await expect(service.filterTripIdsForCustomer('cust1', ['t1', 't2', 't3'])).resolves.toEqual(['t3']);
  });
});

describe('UserBlocksService.assertCanMessage', () => {
  const conversation = { customer: { userId: 'cust1' }, driver: { userId: 'driver1' } };

  it('refuse le message du client vers un conducteur qui l’a bloqué', async () => {
    const { service, prisma } = build();
    prisma.conversation.findUnique.mockResolvedValue(conversation);
    prisma.userBlock.count.mockResolvedValue(1);
    await expect(service.assertCanMessage('cust1', 'c1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.userBlock.count).toHaveBeenCalledWith({
      where: { OR: [{ blockerId: 'cust1', blockedId: 'driver1' }, { blockerId: 'driver1', blockedId: 'cust1' }] },
    });
  });

  it('ne bloque jamais un agent du support, qui n’est ni client ni conducteur', async () => {
    const { service, prisma } = build();
    prisma.conversation.findUnique.mockResolvedValue(conversation);
    prisma.userBlock.count.mockResolvedValue(1);
    await expect(service.assertCanMessage('agent1', 'c1')).resolves.toBeUndefined();
    expect(prisma.userBlock.count).not.toHaveBeenCalled();
  });
});

describe('UserBlocksService.listMine', () => {
  it('n’expose que le prénom et l’initiale du nom', async () => {
    const { service, prisma } = build();
    prisma.userBlock.findMany.mockResolvedValue([
      {
        id: 'b1',
        createdAt: new Date('2026-10-10T10:00:00Z'),
        blocked: {
          id: 'u9',
          accountType: AccountType.DRIVER,
          customerProfile: null,
          driverProfile: { firstName: 'Mamadou', lastName: 'Diallo' },
        },
      },
    ]);
    const [entry] = await service.listMine('u1');
    expect(entry).toMatchObject({ userId: 'u9', name: 'Mamadou D.' });
    expect(JSON.stringify(entry)).not.toContain('Diallo');
  });
});
