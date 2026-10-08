// Adaptateur Orange Money : règles de sécurité de l'argent (jamais de remboursement sur un résultat inconnu, idempotence, jeton réutilisé)
// vérifiées avec un faux serveur. La forme exacte du corps et de la réponse reste à confirmer avec la documentation officielle.
import {
  OrangeMoneyConfig,
  OrangeMoneyPayoutProvider,
  UnknownDisbursementResult,
  buildRequestBody,
  interpretResponse,
  readOrangeMoneyConfig,
} from './orange-money-payout.provider';
import { PayoutProviderRegistry } from './payout-provider.registry';
import { SimulatedPayoutProvider } from './simulated-payout.provider';

const CONFIG: OrangeMoneyConfig = {
  baseUrl: 'https://api.test',
  clientId: 'id',
  clientSecret: 'secret',
  merchantCode: 'MERCH1',
  tokenPath: '/token',
  disbursePath: '/pay',
  timeoutMs: 1000,
};
const PARAMS = { reference: 'w1', amount: 5000n, currencyIsoCode: 'XOF', method: 'orange_money', destination: '+224 620 00 44 17' };

type Reply = { status: number; body?: unknown } | Error;

/** Faux fetch : répond dans l'ordre aux appels (le jeton d'abord, puis le virement). */
function fakeHttp(replies: Reply[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const http = jest.fn().mockImplementation((url: string, init: RequestInit) => {
    calls.push({ url, init });
    const reply = replies.shift();
    if (!reply) throw new Error('Appel inattendu');
    if (reply instanceof Error) return Promise.reject(reply);
    return Promise.resolve({
      status: reply.status,
      ok: reply.status >= 200 && reply.status < 300,
      json: () => (reply.body === undefined ? Promise.reject(new Error('vide')) : Promise.resolve(reply.body)),
    });
  });
  return { http: http as unknown as typeof fetch, calls };
}
const TOKEN: Reply = { status: 200, body: { access_token: 'tok', expires_in: 3600 } };

describe('OrangeMoneyPayoutProvider.disburse', () => {
  it('envoie le virement avec le retrait comme clé d\'idempotence et rend PAID', async () => {
    const { http, calls } = fakeHttp([TOKEN, { status: 200, body: { status: 'SUCCESS', transactionId: 'OM-9' } }]);
    const outcome = await new OrangeMoneyPayoutProvider(CONFIG, http).disburse(PARAMS);
    expect(outcome).toEqual({ status: 'PAID', externalReference: 'OM-9' });
    const disburse = calls[1]!;
    expect(disburse.url).toBe('https://api.test/pay');
    expect((disburse.init.headers as Record<string, string>)['Idempotency-Key']).toBe('w1');
    expect((disburse.init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(JSON.parse(disburse.init.body as string)).toMatchObject({ reference: 'w1', amount: '5000', currency: 'XOF', receiver: { msisdn: '224620004417' } });
  });

  it('réutilise le jeton d\'accès pour le virement suivant', async () => {
    const { http } = fakeHttp([TOKEN, { status: 200, body: { status: 'SUCCESS' } }, { status: 200, body: { status: 'SUCCESS' } }]);
    const provider = new OrangeMoneyPayoutProvider(CONFIG, http);
    await provider.disburse(PARAMS);
    await provider.disburse({ ...PARAMS, reference: 'w2' });
    expect(http).toHaveBeenCalledTimes(3); // 1 jeton + 2 virements
  });

  it('un statut « en attente » reste en cours', async () => {
    const { http } = fakeHttp([TOKEN, { status: 202, body: { status: 'PENDING', transactionId: 'OM-1' } }]);
    expect(await new OrangeMoneyPayoutProvider(CONFIG, http).disburse(PARAMS)).toEqual({ status: 'PROCESSING', externalReference: 'OM-1' });
  });

  it('un refus de validation (422) est un échec définitif : aucun argent parti', async () => {
    const { http } = fakeHttp([TOKEN, { status: 422, body: { message: 'Numéro invalide' } }]);
    expect(await new OrangeMoneyPayoutProvider(CONFIG, http).disburse(PARAMS)).toEqual({ status: 'FAILED', reason: 'Numéro invalide' });
  });

  it.each([500, 502, 408, 429, 409, 403])('HTTP %i = résultat inconnu (exception), jamais un échec remboursé', async (status) => {
    const { http } = fakeHttp([TOKEN, { status, body: {} }]);
    await expect(new OrangeMoneyPayoutProvider(CONFIG, http).disburse(PARAMS)).rejects.toBeInstanceOf(UnknownDisbursementResult);
  });

  it('réseau coupé ou délai dépassé = résultat inconnu', async () => {
    const { http } = fakeHttp([TOKEN, new Error('timeout')]);
    await expect(new OrangeMoneyPayoutProvider(CONFIG, http).disburse(PARAMS)).rejects.toBeInstanceOf(UnknownDisbursementResult);
  });

  it('réponse 200 incompréhensible = résultat inconnu', async () => {
    const { http } = fakeHttp([TOKEN, { status: 200, body: { foo: 'bar' } }]);
    await expect(new OrangeMoneyPayoutProvider(CONFIG, http).disburse(PARAMS)).rejects.toBeInstanceOf(UnknownDisbursementResult);
  });

  it('jeton périmé (401) : un nouveau jeton est demandé et le virement rejoué une seule fois', async () => {
    const { http } = fakeHttp([TOKEN, { status: 401, body: {} }, TOKEN, { status: 200, body: { status: 'SUCCESS' } }]);
    expect((await new OrangeMoneyPayoutProvider(CONFIG, http).disburse(PARAMS)).status).toBe('PAID');
  });

  it('identifiants refusés au jeton = résultat inconnu, aucun virement tenté', async () => {
    const { http, calls } = fakeHttp([{ status: 401, body: {} }]);
    await expect(new OrangeMoneyPayoutProvider(CONFIG, http).disburse(PARAMS)).rejects.toBeInstanceOf(UnknownDisbursementResult);
    expect(calls).toHaveLength(1);
  });
});

describe('fonctions à confirmer', () => {
  it('buildRequestBody envoie le montant en entier texte', () => {
    expect(buildRequestBody(PARAMS, 'M')).toMatchObject({ amount: '5000', merchantCode: 'M' });
  });
  it('interpretResponse reconnaît payé / en attente / refusé et refuse de deviner', () => {
    expect(interpretResponse({ status: 'successful' }, 'r').status).toBe('PAID');
    expect(interpretResponse({ status: 'processing' }, 'r').status).toBe('PROCESSING');
    expect(interpretResponse({ status: 'failed', message: 'x' }, 'r')).toMatchObject({ status: 'FAILED', reason: 'x' });
    expect(() => interpretResponse({}, 'r')).toThrow(UnknownDisbursementResult);
  });
});

describe('configuration et registre', () => {
  const FULL = {
    ORANGE_MONEY_BASE_URL: 'https://api.test/', ORANGE_MONEY_CLIENT_ID: 'a', ORANGE_MONEY_CLIENT_SECRET: 'b',
    ORANGE_MONEY_MERCHANT_CODE: 'c', ORANGE_MONEY_TOKEN_PATH: '/t', ORANGE_MONEY_DISBURSE_PATH: '/d',
  } as NodeJS.ProcessEnv;
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('liste les variables manquantes', () => {
    expect(readOrangeMoneyConfig({ ORANGE_MONEY_BASE_URL: 'x' } as NodeJS.ProcessEnv).missing).toContain('ORANGE_MONEY_DISBURSE_PATH');
  });
  it('retire le « / » final et applique le délai par défaut', () => {
    const { config } = readOrangeMoneyConfig(FULL);
    expect(config).toMatchObject({ baseUrl: 'https://api.test', timeoutMs: 20_000 });
  });
  it('PAYOUT_PROVIDER=orange_money avec configuration incomplète : reste sur la simulation', () => {
    process.env.PAYOUT_PROVIDER = 'orange_money';
    const simulated = new SimulatedPayoutProvider();
    expect(new PayoutProviderRegistry(simulated).get()).toBe(simulated);
  });
  it('PAYOUT_PROVIDER=orange_money avec configuration complète : adaptateur réel (non simulé)', () => {
    process.env = { ...process.env, ...FULL, PAYOUT_PROVIDER: 'orange_money' };
    const provider = new PayoutProviderRegistry(new SimulatedPayoutProvider()).get();
    expect(provider).toBeInstanceOf(OrangeMoneyPayoutProvider);
    expect(provider.isSimulated).toBe(false);
  });
});