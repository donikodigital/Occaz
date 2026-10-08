// Le son d'un push : « default » pour toutes les alertes, sauf quand l'appelant en demande un (messages d'échange).
import { ExpoPushProvider } from './expo-push.provider';

describe('ExpoPushProvider — son et canal', () => {
  const TOKEN = 'ExponentPushToken[abc]';
  const realFetch = global.fetch;
  let sent: Record<string, unknown>[] = [];

  beforeEach(() => {
    sent = [];
    global.fetch = jest.fn().mockImplementation((_url: string, init: { body: string }) => {
      sent.push(...(JSON.parse(init.body) as Record<string, unknown>[]));
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ data: [{ status: 'ok' }] }), text: () => Promise.resolve('') });
    }) as never;
  });
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('garde le son « default » quand aucun son n\'est demandé', async () => {
    await new ExpoPushProvider().send([TOKEN], 'Titre', 'Corps', { type: 'PAYMENT' });
    expect(sent[0]).toMatchObject({ sound: 'default' });
  });

  it('transmet le son et le canal des messages d\'échange', async () => {
    await new ExpoPushProvider().send([TOKEN], 'Awa', 'Salut', { type: 'CONVERSATION_MESSAGE' }, { channelId: 'messages', sound: 'message.wav', priority: 'high' });
    expect(sent[0]).toMatchObject({ sound: 'message.wav', channelId: 'messages', priority: 'high' });
  });
});
