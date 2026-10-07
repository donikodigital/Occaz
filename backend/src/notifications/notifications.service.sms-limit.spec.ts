// backend/src/notifications/notifications.service.sms-limit.spec.ts
// Plafond de SMS de notification par utilisateur et par jour : le SMS est refusé, le push et la trace en base restent.
import { NotificationChannel, NotificationType } from '@prisma/client';
import { NotificationsService } from './notifications.service';

function build(options: { sentToday?: number; limit?: number; smsFails?: boolean } = {}) {
  const prisma = {
    notification: {
      create: jest.fn().mockResolvedValue({ id: 'n1' }),
      update: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(options.sentToday ?? 0),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', phone: '+224620000001', email: 'a@b.test' }) },
    device: { findMany: jest.fn().mockResolvedValue([{ pushToken: 'tok' }]) },
  };
  const templates = { findActive: jest.fn().mockResolvedValue(null) };
  const sms = {
    send: jest.fn().mockImplementation(() => (options.smsFails ? Promise.reject(new Error('gateway down')) : Promise.resolve())),
  };
  const push = { send: jest.fn().mockResolvedValue(undefined) };
  const email = { send: jest.fn().mockResolvedValue(undefined) };
  const otpSettings = { get: jest.fn().mockResolvedValue({ notificationSmsDailyLimitPerUser: options.limit ?? 10 }) };
  const service = new NotificationsService(
    prisma as never,
    templates as never,
    sms as never,
    push as never,
    email as never,
    otpSettings as never,
  );
  return { service, prisma, sms, push };
}

const params = {
  userId: 'u1',
  type: NotificationType.STATUS_CHANGE,
  channels: [NotificationChannel.PUSH, NotificationChannel.SMS],
  fallbackTitle: 'Titre',
  fallbackBody: 'Corps',
};

describe('NotificationsService — plafond de SMS de notification', () => {
  it('sous le plafond : le SMS part et la notification est marquée envoyée', async () => {
    const { service, sms, prisma } = build({ sentToday: 9 });
    await service.notify(params);
    expect(sms.send).toHaveBeenCalledWith('+224620000001', 'Corps');
    expect(prisma.notification.update).toHaveBeenCalledWith(expect.objectContaining({ data: { sentAt: expect.any(Date) } }));
  });

  it('plafond atteint : AUCUN SMS, échec tracé sur la ligne SMS, le push part quand même', async () => {
    const { service, sms, push, prisma } = build({ sentToday: 10 });
    await service.notify(params);
    expect(sms.send).not.toHaveBeenCalled();
    expect(push.send).toHaveBeenCalledTimes(1);
    expect(prisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { failedReason: expect.stringContaining('Plafond quotidien de SMS') } }),
    );
  });

  it('ne compte que les SMS réellement envoyés par cet utilisateur sur 24 h', async () => {
    const { service, prisma } = build();
    await service.notify(params);
    const where = prisma.notification.count.mock.calls[0][0].where;
    expect(where).toMatchObject({ userId: 'u1', channel: NotificationChannel.SMS, sentAt: { not: null } });
    const age = Date.now() - where.createdAt.gte.getTime();
    expect(age).toBeGreaterThan(23.9 * 3_600_000);
    expect(age).toBeLessThan(24.1 * 3_600_000);
  });

  it('plafond à 0 : illimité, sans comptage', async () => {
    const { service, sms, prisma } = build({ sentToday: 999, limit: 0 });
    await service.notify(params);
    expect(sms.send).toHaveBeenCalled();
    expect(prisma.notification.count).not.toHaveBeenCalled();
  });

  it('le plafond ne concerne pas le push : un utilisateur à 10 SMS reçoit toujours ses notifications dans l\'application', async () => {
    const { service, push } = build({ sentToday: 50 });
    await service.notify({ ...params, channels: [NotificationChannel.PUSH] });
    expect(push.send).toHaveBeenCalledTimes(1);
  });
});
