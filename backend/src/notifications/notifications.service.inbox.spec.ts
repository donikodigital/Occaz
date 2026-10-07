// backend/src/notifications/notifications.service.inbox.spec.ts
// Boîte de réception (cloche du back-office) : compteur de non lues, lecture / suppression qui traitent aussi les lignes jumelles
// (même événement sur un autre canal), et alertes envoyées à l'équipe.
import { NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { NotificationsService } from './notifications.service';

const T0 = new Date('2026-10-07T08:00:00.000Z');
const row = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  userId: 'u1',
  type: NotificationType.DISPUTE,
  channel: 'PUSH',
  title: 'Nouveau litige à traiter',
  body: 'Motif : retard',
  readAt: null,
  createdAt: T0,
  ...overrides,
});

function build(rows: Array<ReturnType<typeof row>> = [], staff: Array<{ id: string }> = []) {
  const prisma = {
    notification: {
      findMany: jest.fn().mockResolvedValue(rows),
      findUnique: jest.fn().mockImplementation(({ where }: { where: { id: string } }) => Promise.resolve(rows.find((r) => r.id === where.id) ?? null)),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      createMany: jest.fn().mockResolvedValue({ count: staff.length }),
    },
    user: { findMany: jest.fn().mockResolvedValue(staff) },
  };
  const service = new NotificationsService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never);
  return { service, prisma };
}

describe('NotificationsService.unreadCount', () => {
  it('compte une seule fois un événement envoyé sur plusieurs canaux, et ignore les lues', async () => {
    const { service } = build([
      row('push'),
      row('email', { channel: 'EMAIL', createdAt: new Date(T0.getTime() - 1_000) }), // jumelle de « push »
      row('autre', { title: 'Retrait à valider', createdAt: new Date(T0.getTime() - 60_000) }),
      row('lue', { title: 'Déjà vue', readAt: T0, createdAt: new Date(T0.getTime() - 120_000) }),
    ]);
    await expect(service.unreadCount('u1')).resolves.toEqual({ count: 2 });
  });

  it('boîte vide : 0', async () => {
    const { service } = build([]);
    await expect(service.unreadCount('u1')).resolves.toEqual({ count: 0 });
  });
});

describe('NotificationsService — lecture et suppression', () => {
  it('markRead marque lues la notification ET ses jumelles des autres canaux', async () => {
    const { service, prisma } = build([row('push')]);
    await service.markRead('push', 'u1');
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ userId: 'u1', type: NotificationType.DISPUTE, title: 'Nouveau litige à traiter', readAt: null }),
      data: { readAt: expect.any(Date) },
    });
  });

  it('remove supprime aussi les jumelles : elles ne réapparaissent pas dans la boîte', async () => {
    const { service, prisma } = build([row('push')]);
    await service.remove('push', 'u1');
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ userId: 'u1', body: 'Motif : retard', createdAt: expect.any(Object) }),
    });
  });

  it('refuse de lire ou supprimer la notification d\'un autre compte', async () => {
    const { service, prisma } = build([row('autrui', { userId: 'u2' })]);
    await expect(service.markRead('autrui', 'u1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove('autrui', 'u1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.notification.deleteMany).not.toHaveBeenCalled();
  });

  it('removeMany ignore les ids d\'autrui et supprime la sélection avec ses jumelles', async () => {
    const { service, prisma } = build([row('a')]);
    prisma.notification.findMany.mockResolvedValue([row('a')]);
    await service.removeMany(['a', 'pas-a-moi'], 'u1');
    expect(prisma.notification.findMany).toHaveBeenCalledWith({ where: { id: { in: ['a', 'pas-a-moi'] }, userId: 'u1' } });
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({ where: { OR: [expect.objectContaining({ userId: 'u1' })] } });
  });

  it('removeAll vide la boîte de cet utilisateur seulement', async () => {
    const { service, prisma } = build();
    await service.removeAll('u1');
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
  });
});

describe('NotificationsService.notifyStaff', () => {
  const alert = {
    permission: 'payout.manage',
    type: NotificationType.DRIVER_PAYMENT,
    title: 'Retrait à valider',
    body: 'Un conducteur demande un retrait.',
    link: '/payouts',
  };

  it('crée une notification dans l\'application pour chaque membre de l\'équipe concerné, avec le lien de la page', async () => {
    const { service, prisma } = build([], [{ id: 'admin1' }, { id: 'finance1' }]);
    await service.notifyStaff(alert);

    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(where.isActive).toBe(true);
    expect(JSON.stringify(where)).toContain('payout.manage');
    expect(JSON.stringify(where)).toContain('SUPERADMIN');

    const { data } = prisma.notification.createMany.mock.calls[0][0];
    expect(data.map((item: { userId: string }) => item.userId)).toEqual(['admin1', 'finance1']);
    expect(data[0]).toMatchObject({
      type: NotificationType.DRIVER_PAYMENT,
      title: 'Retrait à valider',
      payload: { link: '/payouts', audience: 'STAFF' },
    });
    expect(data[0].sentAt).toBeInstanceOf(Date);
  });

  it('limite par pays les rôles limités à un pays', async () => {
    const { service, prisma } = build([], [{ id: 'admin1' }]);
    await service.notifyStaff({ ...alert, countryIds: ['gn'] });
    expect(JSON.stringify(prisma.user.findMany.mock.calls[0][0].where)).toContain('"countryId":{"in":["gn"]}');
  });

  it('personne à alerter : rien n\'est écrit', async () => {
    const { service, prisma } = build([], []);
    await service.notifyStaff(alert);
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('ne lève jamais d\'exception, même si la base échoue', async () => {
    const { service, prisma } = build([], [{ id: 'admin1' }]);
    prisma.notification.createMany.mockRejectedValue(new Error('db down'));
    await expect(service.notifyStaff(alert)).resolves.toBeUndefined();
  });
});
