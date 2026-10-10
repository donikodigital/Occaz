// backend/src/user-safety/emergency-contacts.service.spec.ts
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EmergencyContactsService, MAX_EMERGENCY_CONTACTS } from './emergency-contacts.service';

function build(options: { count?: number; ownerPhone?: string; createError?: unknown; deleted?: number } = {}) {
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue({ phone: options.ownerPhone ?? '+224620000001' }) },
    emergencyContact: {
      count: jest.fn().mockResolvedValue(options.count ?? 0),
      create: options.createError
        ? jest.fn().mockRejectedValue(options.createError)
        : jest.fn().mockResolvedValue({ id: 'e1', name: 'Mariama', phone: '+224620000002', createdAt: new Date() }),
      deleteMany: jest.fn().mockResolvedValue({ count: options.deleted ?? 1 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  return { service: new EmergencyContactsService(prisma as never), prisma };
}

const dto = { name: '  Mariama  ', phone: '+224620000002' };

describe('EmergencyContactsService', () => {
  it('ajoute un proche (nom nettoyé)', async () => {
    const { service, prisma } = build();
    await service.add('u1', dto);
    expect(prisma.emergencyContact.create.mock.calls[0][0].data).toEqual({ userId: 'u1', name: 'Mariama', phone: '+224620000002' });
  });

  it(`refuse au-delà de ${MAX_EMERGENCY_CONTACTS} proches`, async () => {
    const { service, prisma } = build({ count: MAX_EMERGENCY_CONTACTS });
    await expect(service.add('u1', dto)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.emergencyContact.create).not.toHaveBeenCalled();
  });

  it('refuse son propre numéro', async () => {
    const { service } = build({ ownerPhone: '+224620000002' });
    await expect(service.add('u1', dto)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('signale un numéro déjà enregistré (409)', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' });
    const { service } = build({ createError: error });
    await expect(service.add('u1', dto)).rejects.toBeInstanceOf(ConflictException);
  });

  it('ne supprime que ses propres proches', async () => {
    const { service, prisma } = build();
    await service.remove('u1', 'e1');
    expect(prisma.emergencyContact.deleteMany).toHaveBeenCalledWith({ where: { id: 'e1', userId: 'u1' } });
  });

  it('suppression d’un proche inconnu : 404', async () => {
    const { service } = build({ deleted: 0 });
    await expect(service.remove('u1', 'nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});
