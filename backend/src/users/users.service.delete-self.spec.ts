// backend/src/users/users.service.delete-self.spec.ts
import { BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';

/**
 * Suppression de compte en libre-service : désactive le compte (isActive
 * false, même mécanique que la désactivation admin), et refuse tant qu'une
 * réservation, un envoi ou un trajet est encore en cours, pour ne jamais
 * laisser l'autre partie d'une prestation sans interlocuteur.
 */
function createService(options: { bookingCount?: number; shipmentCount?: number; tripCount?: number } = {}) {
  const prisma = {
    booking: { count: jest.fn().mockResolvedValue(options.bookingCount ?? 0) },
    shipment: { count: jest.fn().mockResolvedValue(options.shipmentCount ?? 0) },
    trip: { count: jest.fn().mockResolvedValue(options.tripCount ?? 0) },
    user: { update: jest.fn().mockResolvedValue({ id: 'u1', isActive: false }) },
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const service = new UsersService(prisma as never, audit as never);
  return { service, prisma, audit };
}

describe('UsersService.deleteSelf', () => {
  it('désactive le compte et journalise la raison', async () => {
    const { service, prisma, audit } = createService();
    await service.deleteSelf('u1', { reason: 'Je ne l’utilise plus' });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1' }, data: { isActive: false } }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'u1', action: 'SELF_DELETE', diff: { reason: 'Je ne l’utilise plus' } }),
    );
  });

  it('refuse s’il reste une réservation en cours', async () => {
    const { service, prisma } = createService({ bookingCount: 1 });
    await expect(service.deleteSelf('u1', {})).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('refuse s’il reste un envoi en cours', async () => {
    const { service, prisma } = createService({ shipmentCount: 1 });
    await expect(service.deleteSelf('u1', {})).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('refuse à un chauffeur avec un trajet en cours', async () => {
    const { service, prisma } = createService({ tripCount: 1 });
    await expect(service.deleteSelf('u1', {})).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});