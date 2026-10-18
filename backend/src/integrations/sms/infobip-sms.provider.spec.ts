// backend/src/integrations/sms/infobip-sms.provider.spec.ts
import { InfobipSmsProvider, normalizeInfobipBaseUrl, toInfobipNumber } from './infobip-sms.provider';
import { createSmsProvider } from './sms.module';
import { ConsoleSmsProvider } from './console-sms.provider';
import { TextBeeSmsProvider } from './textbee-sms.provider';

const ENV_KEYS = ['INFOBIP_API_KEY', 'INFOBIP_BASE_URL', 'INFOBIP_SENDER'] as const;

describe('helpers Infobip', () => {
  it('complète et nettoie l’adresse du compte', () => {
    expect(normalizeInfobipBaseUrl(undefined)).toBe('https://api.infobip.com');
    expect(normalizeInfobipBaseUrl('abc12.api.infobip.com')).toBe('https://abc12.api.infobip.com');
    expect(normalizeInfobipBaseUrl(' https://abc12.api.infobip.com/ ')).toBe('https://abc12.api.infobip.com');
  });

  it('envoie le numéro sans « + » ni espaces', () => {
    expect(toInfobipNumber('+224 622 34 32 34')).toBe('224622343234');
  });
});

describe('InfobipSmsProvider.send', () => {
  const previous: Record<string, string | undefined> = {};
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    for (const key of ENV_KEYS) previous[key] = process.env[key];
    process.env.INFOBIP_API_KEY = 'secret-key';
    process.env.INFOBIP_BASE_URL = 'abc12.api.infobip.com';
    delete process.env.INFOBIP_SENDER;
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
    for (const key of ENV_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });

  const reply = (status: number, body: unknown) =>
    fetchMock.mockResolvedValue(new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }));

  it('appelle /sms/3/messages avec la clé et le bon corps', async () => {
    reply(200, { messages: [{ messageId: 'm1', status: { groupName: 'PENDING' } }] });
    await new InfobipSmsProvider().send('+224622343234', 'Code : 123456');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://abc12.api.infobip.com/sms/3/messages');
    expect(init.headers.Authorization).toBe('App secret-key');
    expect(JSON.parse(init.body)).toEqual({
      messages: [{ destinations: [{ to: '224622343234' }], content: { text: 'Code : 123456' } }],
    });
  });

  it('joint le nom d’expéditeur quand il est défini', async () => {
    process.env.INFOBIP_SENDER = 'OccaZ';
    reply(200, { messages: [{ status: { groupName: 'PENDING' } }] });
    await new InfobipSmsProvider().send('+221775099995', 'x');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).messages[0].sender).toBe('OccaZ');
  });

  it('échoue clairement sans clé API', async () => {
    delete process.env.INFOBIP_API_KEY;
    await expect(new InfobipSmsProvider().send('+224622343234', 'x')).rejects.toThrow('INFOBIP_API_KEY');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('remonte une réponse HTTP en erreur', async () => {
    reply(401, { requestError: { serviceException: { text: 'Invalid login details' } } });
    await expect(new InfobipSmsProvider().send('+224622343234', 'x')).rejects.toThrow(/401.*Invalid login details/);
  });

  it('remonte un message refusé malgré un statut 200', async () => {
    reply(200, { messages: [{ status: { groupName: 'REJECTED', name: 'REJECTED_SENDER', description: 'Sender not allowed' } }] });
    await expect(new InfobipSmsProvider().send('+224622343234', 'x')).rejects.toThrow(/REJECTED_SENDER.*Sender not allowed/);
  });

  it('traduit une panne réseau', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));
    await expect(new InfobipSmsProvider().send('+224622343234', 'x')).rejects.toThrow('Connexion à Infobip impossible : ECONNRESET');
  });
});

describe('createSmsProvider', () => {
  it('Infobip est prioritaire sur TextBee', () => {
    expect(createSmsProvider({ INFOBIP_API_KEY: 'a', TEXTBEE_API_KEY: 'b' })).toBeInstanceOf(InfobipSmsProvider);
  });
  it('TextBee quand Infobip n’est pas configuré', () => {
    expect(createSmsProvider({ TEXTBEE_API_KEY: 'b' })).toBeInstanceOf(TextBeeSmsProvider);
  });
  it('la console sans aucune clé', () => {
    expect(createSmsProvider({})).toBeInstanceOf(ConsoleSmsProvider);
  });
});
