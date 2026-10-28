// backend/src/notifications/notifications.service.spaces.spec.ts
// Espaces client / conducteur : une même personne ne voit dans l'un que les notifications de l'autre ; sans espace, rien ne change.
import { NotificationType } from '@prisma/client';
import { NotificationsService, belongsToSpace } from './notifications.service';

const T0 = new Date('2026-10-28T08:00:00.000Z');
let counter = 0;
const row = (type: NotificationType, title: string, payload: unknown = null, overrides: Record<string, unknown> = {}) => ({
  id: `n${++counter}`,
  userId: 'u1',
  type,
  channel: 'PUSH',
  title,
  body: `${title} — corps`,
  payload,
  readAt: null,
  // Chaque ligne est à 1 minute de la précédente : aucune n'est la « jumelle » d'une autre.
  createdAt: new Date(T0.getTime() - counter * 60_000),
  ...overrides,
});

function build(rows: Array<ReturnType<typeof row>>) {
  const prisma = {
    notification: {
      findMany: jest.fn().mockResolvedValue(rows),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const service = new NotificationsService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never);
  return { service, prisma };
}

describe('belongsToSpace', () => {
  it("suit l'audience inscrite dans le payload", () => {
    expect(belongsToSpace({ type: NotificationType.STATUS_CHANGE, payload: { audience: 'DRIVER' } }, 'DRIVER')).toBe(true);
    expect(belongsToSpace({ type: NotificationType.STATUS_CHANGE, payload: { audience: 'DRIVER' } }, 'CUSTOMER')).toBe(false);
    expect(belongsToSpace({ type: NotificationType.STATUS_CHANGE, payload: { audience: 'CUSTOMER' } }, 'CUSTOMER')).toBe(true);
  });

  it("l'audience du payload l'emporte sur celle du type", () => {
    expect(belongsToSpace({ type: NotificationType.BOOKING, payload: { audience: 'CUSTOMER' } }, 'DRIVER')).toBe(false);
  });

  it("anciennes lignes : déduit l'espace du type quand il est sans équivoque", () => {
    expect(belongsToSpace({ type: NotificationType.BOOKING, payload: null }, 'DRIVER')).toBe(true);
    expect(belongsToSpace({ type: NotificationType.BOOKING, payload: null }, 'CUSTOMER')).toBe(false);
    expect(belongsToSpace({ type: NotificationType.PAYMENT, payload: null }, 'CUSTOMER')).toBe(true);
    expect(belongsToSpace({ type: NotificationType.PAYMENT, payload: null }, 'DRIVER')).toBe(false);
  });

  it('type ambigu et sans audience : visible dans les deux espaces', () => {
    expect(belongsToSpace({ type: NotificationType.STATUS_CHANGE, payload: null }, 'DRIVER')).toBe(true);
    expect(belongsToSpace({ type: NotificationType.STATUS_CHANGE, payload: null }, 'CUSTOMER')).toBe(true);
  });

  it("n'affiche jamais les alertes du back-office dans un espace de l'application", () => {
    expect(belongsToSpace({ type: NotificationType.DRIVER_PAYMENT, payload: { audience: 'STAFF' } }, 'DRIVER')).toBe(false);
    expect(belongsToSpace({ type: NotificationType.DRIVER_PAYMENT, payload: { audience: 'STAFF' } }, 'CUSTOMER')).toBe(false);
  });
});

describe('NotificationsService — boîte par espace', () => {
  const rows = () => [
    row(NotificationType.STATUS_CHANGE, 'Réservation annulée', { audience: 'DRIVER' }),
    row(NotificationType.STATUS_CHANGE, 'Trajet annulé', { audience: 'CUSTOMER' }),
    row(NotificationType.STATUS_CHANGE, 'Ancienne notification', null),
  ];

  it('findMine avec un espace ne renvoie que ses notifications (et les anciennes ambiguës)', async () => {
    const { service } = build(rows());
    const driver = await service.findMine('u1', { page: 1, limit: 20, skip: 0, take: 20 } as never, 'DRIVER');
    expect((driver.data as Array<{ title: string }>).map((n) => n.title)).toEqual(['Réservation annulée', 'Ancienne notification']);
    const customer = await service.findMine('u1', { page: 1, limit: 20, skip: 0, take: 20 } as never, 'CUSTOMER');
    expect((customer.data as Array<{ title: string }>).map((n) => n.title)).toEqual(['Trajet annulé', 'Ancienne notification']);
  });

  it('findMine sans espace renvoie toute la boîte', async () => {
    const { service } = build(rows());
    const all = await service.findMine('u1', { page: 1, limit: 20, skip: 0, take: 20 } as never);
    expect(all.data).toHaveLength(3);
  });

  it("unreadCount ne compte que l'espace demandé", async () => {
    const { service } = build(rows());
    await expect(service.unreadCount('u1', 'DRIVER')).resolves.toEqual({ count: 2 });
    await expect(service.unreadCount('u1')).resolves.toEqual({ count: 3 });
  });

  it("markAllRead d'un espace ne touche pas l'autre espace", async () => {
    const data = rows();
    const { service, prisma } = build(data);
    await service.markAllRead('u1', 'DRIVER');
    const where = prisma.notification.updateMany.mock.calls[0][0].where;
    expect(where.id.in).toEqual([data[0].id, data[2].id]);
    expect(where.id.in).not.toContain(data[1].id);
  });

  it('markAllRead sans espace marque toute la boîte, comme avant', async () => {
    const { service, prisma } = build(rows());
    await service.markAllRead('u1');
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({ where: { userId: 'u1', readAt: null }, data: { readAt: expect.any(Date) } });
  });

  it("removeAll d'un espace ne supprime que ses lignes", async () => {
    const data = rows();
    const { service, prisma } = build(data);
    await service.removeAll('u1', 'CUSTOMER');
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [data[1].id, data[2].id] } } });
  });

  it('removeAll sans espace vide toute la boîte, comme avant', async () => {
    const { service, prisma } = build(rows());
    await service.removeAll('u1');
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
  });
});
