// backend/src/rbac/user-roles.service.spec.ts
// Le rôle « superadmin » ne se retire pas : personne ne pourrait le redonner à un SuperAdmin qui se le serait retiré.
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRolesService } from './user-roles.service';

function build(userRole: { id: string; role: { key: string } } | null) {
  const prisma = {
    userRole: {
      findUnique: jest.fn().mockResolvedValue(userRole),
      delete: jest.fn().mockResolvedValue(undefined),
    },
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  return { service: new UserRolesService(prisma as never, audit as never), prisma, audit };
}

describe('UserRolesService.revoke', () => {
  it('refuse de retirer le rôle superadmin : rien n\'est supprimé ni journalisé', async () => {
    const { service, prisma, audit } = build({ id: 'ur1', role: { key: 'superadmin' } });
    await expect(service.revoke('ur1', 'actor')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.userRole.delete).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('retire un autre rôle et le journalise', async () => {
    const { service, prisma, audit } = build({ id: 'ur2', role: { key: 'support_agent' } });
    await service.revoke('ur2', 'actor');
    expect(prisma.userRole.delete).toHaveBeenCalledWith({ where: { id: 'ur2' } });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ entityId: 'ur2', action: 'REVOKE', actorId: 'actor' }));
  });

  it('attribution inconnue : 404', async () => {
    const { service } = build(null);
    await expect(service.revoke('absent', 'actor')).rejects.toBeInstanceOf(NotFoundException);
  });
});
