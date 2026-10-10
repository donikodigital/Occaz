// backend/src/user-safety/user-reports.service.spec.ts
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AccountType, UserReportReason, UserReportStatus } from '@prisma/client';
import { MAX_REPORTS_PER_DAY, UserReportsService } from './user-reports.service';

const dto = { userId: 'u2', reason: UserReportReason.HARASSMENT, details: '  insultes  ' };

function build(options: { target?: unknown; duplicate?: unknown; recent?: number } = {}) {
  const prisma = {
    user: { findFirst: jest.fn().mockResolvedValue('target' in options ? options.target : { id: 'u2', accountType: AccountType.DRIVER }) },
    userReport: {
      findFirst: jest.fn().mockResolvedValue(options.duplicate ?? null),
      count: jest.fn().mockResolvedValue(options.recent ?? 0),
      create: jest.fn().mockResolvedValue({ id: 'r1' }),
      findUnique: jest.fn().mockResolvedValue({ id: 'r1', status: UserReportStatus.OPEN }),
      update: jest.fn().mockResolvedValue({ id: 'r1', status: UserReportStatus.RESOLVED }),
    },
  };
  const blocks = {
    block: jest.fn().mockResolvedValue({ blocked: true }),
    resolveTargetUserId: jest.fn().mockImplementation((target: { userId?: string }) => Promise.resolve(target.userId ?? 'u2')),
  };
  const notifications = { notifyStaff: jest.fn().mockResolvedValue(undefined) };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const service = new UserReportsService(prisma as never, blocks as never, notifications as never, audit as never);
  return { service, prisma, blocks, notifications, audit };
}

describe('UserReportsService.create', () => {
  it('enregistre le signalement (texte nettoyé) et alerte le support', async () => {
    const { service, prisma, notifications } = build();
    await expect(service.create('u1', dto)).resolves.toEqual({ id: 'r1', alreadyReported: false, blocked: false });
    expect(prisma.userReport.create.mock.calls[0][0].data).toMatchObject({ reporterId: 'u1', reportedUserId: 'u2', details: 'insultes' });
    expect(notifications.notifyStaff).toHaveBeenCalledWith(expect.objectContaining({ permission: 'user_report.read' }));
  });

  it('bloque aussi la personne quand on le demande', async () => {
    const { service, blocks } = build();
    await expect(service.create('u1', { ...dto, alsoBlock: true })).resolves.toMatchObject({ blocked: true });
    expect(blocks.block).toHaveBeenCalledWith('u1', 'u2');
  });

  it('refuse de se signaler soi-même', async () => {
    const { service } = build();
    await expect(service.create('u2', dto)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse un utilisateur introuvable', async () => {
    const { service } = build({ target: null });
    await expect(service.create('u1', dto)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuse de signaler un compte du support', async () => {
    const { service } = build({ target: { id: 'u2', accountType: AccountType.SUPPORT } });
    await expect(service.create('u1', dto)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('ne crée pas de doublon pour un signalement déjà en cours aujourd’hui', async () => {
    const { service, prisma, notifications } = build({ duplicate: { id: 'r0' } });
    await expect(service.create('u1', dto)).resolves.toEqual({ id: 'r0', alreadyReported: true, blocked: false });
    expect(prisma.userReport.create).not.toHaveBeenCalled();
    expect(notifications.notifyStaff).not.toHaveBeenCalled();
  });

  it('plafonne le nombre de signalements par jour', async () => {
    const { service, prisma } = build({ recent: MAX_REPORTS_PER_DAY });
    await expect(service.create('u1', dto)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.userReport.create).not.toHaveBeenCalled();
  });
});

describe('UserReportsService.update', () => {
  it('clôture un signalement : date de traitement, agent et trace dans le journal d’audit', async () => {
    const { service, prisma, audit } = build();
    await service.update('r1', { status: UserReportStatus.RESOLVED, resolutionNote: ' Compte averti ' }, 'agent1');
    const data = prisma.userReport.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: 'RESOLVED', resolutionNote: 'Compte averti', handledById: 'agent1' });
    expect(data.handledAt).toBeInstanceOf(Date);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'UserReport', action: 'user_report.update' }));
  });

  it('« en cours d’examen » ne marque pas le signalement comme traité', async () => {
    const { service, prisma } = build();
    await service.update('r1', { status: UserReportStatus.IN_REVIEW }, 'agent1');
    expect(prisma.userReport.update.mock.calls[0][0].data.handledAt).toBeNull();
  });

  it('signalement introuvable', async () => {
    const { service, prisma } = build();
    prisma.userReport.findUnique.mockResolvedValue(null);
    await expect(service.update('nope', { status: UserReportStatus.DISMISSED }, 'agent1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
