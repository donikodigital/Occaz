// backend/src/notifications/notifications.service.language.spec.ts
// Chaque destinataire reçoit son SMS / e-mail / push dans SA langue — pas celle de la personne dont la requête a déclenché l'envoi.
import { NotificationChannel } from '@prisma/client';
import { currentLanguage, runWithLanguage } from '../i18n/language-context';
import { NotificationsService } from './notifications.service';

function build(language: string) {
  const seen: Record<string, string> = {};
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', phone: '+224620000000', email: 'a@b.gn', language }) },
    device: { findMany: jest.fn().mockResolvedValue([{ pushToken: 'ExponentPushToken[abc]' }]) },
  };
  const spy = (channel: string) => jest.fn().mockImplementation(async () => { seen[channel] = currentLanguage(); });
  const sms = { send: spy('sms') };
  const push = { send: spy('push') };
  const email = { send: spy('email') };
  const service = new NotificationsService(prisma as never, {} as never, sms as never, push as never, email as never, {} as never);
  // On teste l'envoi sur un canal : la méthode privée `send` fixe la langue du destinataire.
  const send = (channel: NotificationChannel) =>
    (service as unknown as { send: (...args: unknown[]) => Promise<void> }).send('u1', channel, 'Titre', 'Corps');
  return { seen, send, prisma };
}

describe('NotificationsService — langue du destinataire', () => {
  it.each([
    ['pt-PT', 'pt-PT'],
    ['en-GB', 'en-GB'],
    ['fr', 'fr'],
    ['klingon', 'fr'],
  ])('compte en « %s » : push et e-mail écrits en « %s »', async (account, expected) => {
    const { seen, send } = build(account);
    await send(NotificationChannel.PUSH);
    await send(NotificationChannel.EMAIL);
    expect(seen.push).toBe(expected);
    expect(seen.email).toBe(expected);
  });

  it('la langue de la requête (un client en anglais) ne déteint pas sur le conducteur destinataire (en portugais)', async () => {
    const { seen, send } = build('pt-PT');
    await runWithLanguage('en-GB', async () => {
      expect(currentLanguage()).toBe('en-GB');
      await send(NotificationChannel.PUSH);
      expect(currentLanguage()).toBe('en-GB');
    });
    expect(seen.push).toBe('pt-PT');
  });
});
