// backend/src/integrations/sms/orange-sms.provider.spec.ts
import {
  buildOrangeAuthorization,
  isOrangeSmsConfigured,
  normalizeOrangeBaseUrl,
  normalizeSenderAddress,
  OrangeSmsProvider,
  toOrangeAddress,
} from './orange-sms.provider';
import { CountryRoutingSmsProvider, toE164 } from './routing-sms.provider';
import { createSmsProvider } from './sms.module';
import { InfobipSmsProvider } from './infobip-sms.provider';
import { ConsoleSmsProvider } from './console-sms.provider';

const ENV_KEYS = [
  'ORANGE_SMS_CLIENT_ID',
  'ORANGE_SMS_CLIENT_SECRET',
  'ORANGE_SMS_AUTHORIZATION_HEADER',
  'ORANGE_SMS_SENDER_ADDRESS',
  'ORANGE_SMS_SENDER_NAME',
  'ORANGE_SMS_BASE_URL',
] as const;

describe('helpers Orange', () => {
  it('complète et nettoie l’adresse de l’API', () => {
    expect(normalizeOrangeBaseUrl(undefined)).toBe('https://api.orange.com');
    expect(normalizeOrangeBaseUrl(' api.orange.com/ ')).toBe('https://api.orange.com');
  });

  it('met le numéro au format tel:+…', () => {
    expect(toOrangeAddress('+224 622 34 32 34')).toBe('tel:+224622343234');
  });

  it('accepte l’adresse d’expéditeur sous plusieurs écritures, avec « tel:+224000 » par défaut', () => {
    expect(normalizeSenderAddress(undefined)).toBe('tel:+224000');
    expect(normalizeSenderAddress('224111')).toBe('tel:+224111');
    expect(normalizeSenderAddress('tel:+224111')).toBe('tel:+224111');
  });

  it('construit l’en-tête Basic avec l’identifiant et le secret, ou reprend celui fourni', () => {
    expect(buildOrangeAuthorization({})).toBeUndefined();
    expect(buildOrangeAuthorization({ ORANGE_SMS_CLIENT_ID: 'id' })).toBeUndefined();
    expect(buildOrangeAuthorization({ ORANGE_SMS_CLIENT_ID: 'id', ORANGE_SMS_CLIENT_SECRET: 'secret' })).toBe(
      `Basic ${Buffer.from('id:secret').toString('base64')}`,
    );
    expect(buildOrangeAuthorization({ ORANGE_SMS_AUTHORIZATION_HEADER: 'Basic abc' })).toBe('Basic abc');
    expect(buildOrangeAuthorization({ ORANGE_SMS_AUTHORIZATION_HEADER: 'abc' })).toBe('Basic abc');
    expect(isOrangeSmsConfigured({ ORANGE_SMS_AUTHORIZATION_HEADER: 'abc' })).toBe(true);
    expect(isOrangeSmsConfigured({})).toBe(false);
  });
});

describe('OrangeSmsProvider.send', () => {
  const previous: Record<string, string | undefined> = {};
  let fetchMock: jest.SpyInstance;

  const tokenReply = (token = 'tok-1', expiresIn: string | number = '3600') =>
    new Response(JSON.stringify({ token_type: 'Bearer', access_token: token, expires_in: expiresIn }), { status: 200 });
  const sentReply = () =>
    new Response(JSON.stringify({ outboundSMSMessageRequest: {} }), { status: 201, headers: { Location: 'https://x/requests/abc' } });

  beforeEach(() => {
    for (const key of ENV_KEYS) previous[key] = process.env[key];
    for (const key of ENV_KEYS) delete process.env[key];
    process.env.ORANGE_SMS_CLIENT_ID = 'id';
    process.env.ORANGE_SMS_CLIENT_SECRET = 'secret';
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
    for (const key of ENV_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });

  it('demande un jeton puis envoie le SMS avec le bon corps', async () => {
    fetchMock.mockResolvedValueOnce(tokenReply()).mockResolvedValueOnce(sentReply());
    await new OrangeSmsProvider().send('+224622343234', 'Code : 123456');

    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0];
    expect(tokenUrl).toBe('https://api.orange.com/oauth/v3/token');
    expect(tokenInit.headers.Authorization).toBe(`Basic ${Buffer.from('id:secret').toString('base64')}`);
    expect(tokenInit.body).toBe('grant_type=client_credentials');

    const [sendUrl, sendInit] = fetchMock.mock.calls[1];
    expect(sendUrl).toBe('https://api.orange.com/smsmessaging/v1/outbound/tel%3A%2B224000/requests');
    expect(sendInit.headers.Authorization).toBe('Bearer tok-1');
    expect(JSON.parse(sendInit.body)).toEqual({
      outboundSMSMessageRequest: {
        address: 'tel:+224622343234',
        senderAddress: 'tel:+224000',
        outboundSMSTextMessage: { message: 'Code : 123456' },
      },
    });
  });

  it('joint le nom d’expéditeur et l’adresse d’expéditeur configurés', async () => {
    process.env.ORANGE_SMS_SENDER_NAME = 'OccaZ';
    process.env.ORANGE_SMS_SENDER_ADDRESS = 'tel:+224111';
    fetchMock.mockResolvedValueOnce(tokenReply()).mockResolvedValueOnce(sentReply());
    await new OrangeSmsProvider().send('+224622343234', 'x');
    expect(fetchMock.mock.calls[1][0]).toContain('tel%3A%2B224111');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).outboundSMSMessageRequest.senderName).toBe('OccaZ');
  });

  it('garde le jeton en mémoire : un deuxième SMS ne redemande pas de jeton', async () => {
    fetchMock.mockResolvedValueOnce(tokenReply()).mockResolvedValueOnce(sentReply()).mockResolvedValueOnce(sentReply());
    const provider = new OrangeSmsProvider();
    await provider.send('+224622343234', 'a');
    await provider.send('+224622343234', 'b');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/oauth/')).length).toBe(1);
  });

  it('renouvelle un jeton sur le point d’expirer', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenReply('tok-1', 30))
      .mockResolvedValueOnce(sentReply())
      .mockResolvedValueOnce(tokenReply('tok-2'))
      .mockResolvedValueOnce(sentReply());
    const provider = new OrangeSmsProvider();
    await provider.send('+224622343234', 'a');
    await provider.send('+224622343234', 'b');
    expect(fetchMock.mock.calls[3][1].headers.Authorization).toBe('Bearer tok-2');
  });

  it('une seule demande de jeton pour plusieurs SMS simultanés', async () => {
    fetchMock.mockImplementation((url: string) => Promise.resolve(String(url).includes('/oauth/') ? tokenReply() : sentReply()));
    const provider = new OrangeSmsProvider();
    await Promise.all([provider.send('+224622343234', 'a'), provider.send('+224622343235', 'b'), provider.send('+224622343236', 'c')]);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/oauth/')).length).toBe(1);
  });

  it('sur un 401, redemande un jeton et réessaie une fois', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenReply('vieux'))
      .mockResolvedValueOnce(new Response('{"code":42,"message":"Expired credentials"}', { status: 401 }))
      .mockResolvedValueOnce(tokenReply('neuf'))
      .mockResolvedValueOnce(sentReply());
    await new OrangeSmsProvider().send('+224622343234', 'x');
    expect(fetchMock.mock.calls[3][1].headers.Authorization).toBe('Bearer neuf');
  });

  it('échoue clairement sans identifiants', async () => {
    delete process.env.ORANGE_SMS_CLIENT_ID;
    await expect(new OrangeSmsProvider().send('+224622343234', 'x')).rejects.toThrow('ORANGE_SMS_CLIENT_ID');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('remonte un refus d’authentification', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"error":"invalid_client","error_description":"Invalid client or Invalid client credentials"}', { status: 401 }));
    await expect(new OrangeSmsProvider().send('+224622343234', 'x')).rejects.toThrow(/authentification \(401\).*Invalid client/);
  });

  it('remonte l’erreur d’Orange (expéditeur non approuvé, solde épuisé…)', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenReply())
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ requestError: { serviceException: { messageId: 'SVC0001', text: 'Sender name not allowed' } } }), { status: 400 }),
      );
    await expect(new OrangeSmsProvider().send('+224622343234', 'x')).rejects.toThrow(/400.*SVC0001.*Sender name not allowed/);
  });

  it('traduit une panne réseau', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));
    await expect(new OrangeSmsProvider().send('+224622343234', 'x')).rejects.toThrow('Connexion à Orange impossible : ECONNRESET');
  });
});

describe('CountryRoutingSmsProvider', () => {
  const orange = { send: jest.fn().mockResolvedValue(undefined) };
  const world = { send: jest.fn().mockResolvedValue(undefined) };
  const router = new CountryRoutingSmsProvider([{ prefix: '+224', provider: orange }], world);

  beforeEach(() => {
    orange.send.mockClear();
    world.send.mockClear();
  });

  it('envoie les numéros guinéens par Orange', async () => {
    await router.send('+224622343234', 'a');
    await router.send('00224 622 34 32 34', 'b');
    expect(orange.send).toHaveBeenCalledTimes(2);
    expect(world.send).not.toHaveBeenCalled();
  });

  it('envoie les autres pays par le fournisseur international', async () => {
    await router.send('+33766736226', 'a');
    await router.send('+221775099995', 'b');
    expect(world.send).toHaveBeenCalledTimes(2);
    expect(orange.send).not.toHaveBeenCalled();
  });

  it('normalise les écritures du numéro', () => {
    expect(toE164('+224 622-34-32-34')).toBe('+224622343234');
    expect(toE164('0033766736226')).toBe('+33766736226');
  });
});

describe('createSmsProvider avec Orange', () => {
  it('ajoute le routage de la Guinée quand Orange est configuré', () => {
    const provider = createSmsProvider({ ORANGE_SMS_CLIENT_ID: 'id', ORANGE_SMS_CLIENT_SECRET: 's', INFOBIP_API_KEY: 'k' });
    expect(provider).toBeInstanceOf(CountryRoutingSmsProvider);
    const router = provider as CountryRoutingSmsProvider;
    expect(router.providerFor('+224622343234')).toBeInstanceOf(OrangeSmsProvider);
    expect(router.providerFor('+33766736226')).toBeInstanceOf(InfobipSmsProvider);
  });

  it('sans Infobip ni TextBee, les autres pays tombent sur la console', () => {
    const router = createSmsProvider({ ORANGE_SMS_CLIENT_ID: 'id', ORANGE_SMS_CLIENT_SECRET: 's' }) as CountryRoutingSmsProvider;
    expect(router.providerFor('+33766736226')).toBeInstanceOf(ConsoleSmsProvider);
  });

  it('sans Orange, rien ne change', () => {
    expect(createSmsProvider({ INFOBIP_API_KEY: 'k' })).toBeInstanceOf(InfobipSmsProvider);
  });
});
