// backend/src/notifications/notifications.service.push-dedupe.spec.ts
// Un téléphone ne reçoit qu'une fois la même notification, même si la base garde plusieurs lignes « appareil » avec son token.
import { NotificationChannel, NotificationType } from '@prisma/client';
import { NotificationsService } from './notifications.service';

function build(tokens: Array<string | null>) {
  const prisma = {
    notification: {
      create: jest.fn().mockResolvedValue({ id: 'n1' }),
      update: jest.fn().mockResolvedValue({}),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', phone: '+224620000001', email: 'a@b.test' }) },
    device: { findMany: jest.fn().mockResolvedValue(tokens.map((pushToken) => ({ pushToken }))) },
  };
  const push = { send: jest.fn().mockResolvedValue(undefined) };
  const service = new NotificationsService(
    prisma as never,
    { findActive: jest.fn().mockResolvedValue(null) } as never,
    { send: jest.fn() } as never,
    push as never,
    { send: jest.fn() } as never,
    { get: jest.fn() } as never,
  );
  return { service, push };
}

describe('NotificationsService — push sans doublon', () => {
  it('trois lignes avec le même token : un seul token transmis au fournisseur push', async () => {
    const { service, push } = build(['ExponentPushToken[abc]', 'ExponentPushToken[abc]', 'ExponentPushToken[abc]']);
    await service.notify({
      userId: 'u1',
      type: NotificationType.DRIVER_PAYMENT,
      channels: [NotificationChannel.PUSH],
      fallbackTitle: 'Retrait effectué',
      fallbackBody: '7 000 XOF ont été envoyés.',
    });
    expect(push.send).toHaveBeenCalledTimes(1);
    expect(push.send.mock.calls[0][0]).toEqual(['ExponentPushToken[abc]']);
  });

  it('deux téléphones différents reçoivent chacun la notification', async () => {
    const { service, push } = build(['ExponentPushToken[a]', 'ExponentPushToken[b]', 'ExponentPushToken[a]']);
    await service.notify({
      userId: 'u1',
      type: NotificationType.DRIVER_PAYMENT,
      channels: [NotificationChannel.PUSH],
      fallbackTitle: 'Titre',
      fallbackBody: 'Corps',
    });
    expect(push.send.mock.calls[0][0]).toEqual(['ExponentPushToken[a]', 'ExponentPushToken[b]']);
  });
});
