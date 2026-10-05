// backend/src/wallets/providers/simulated-payout.provider.spec.ts
import { PayoutProviderRegistry } from './payout-provider.registry';
import { SimulatedPayoutProvider } from './simulated-payout.provider';

const params = (destination: string) => ({ reference: 'p1', amount: 15_000n, currencyIsoCode: 'XOF', method: 'orange_money', destination });

describe('SimulatedPayoutProvider', () => {
  const provider = new SimulatedPayoutProvider();

  it('« envoie » instantanément, avec une référence de simulation', async () => {
    const outcome = await provider.disburse(params('+224620004417'));
    expect(outcome.status).toBe('PAID');
    expect((outcome as { externalReference: string }).externalReference).toMatch(/^SIM-/);
  });

  it('un numéro de test se terminant par 0000 est refusé (pour essayer le circuit d\'échec)', async () => {
    expect(await provider.disburse(params('+224620000000'))).toMatchObject({ status: 'FAILED' });
    expect(await provider.disburse(params('+22462 00 00 00'.replace(/ /g, '') + '0'))).toMatchObject({ status: 'FAILED' });
  });

  it('se déclare simulé : aucun argent réel ne bouge', () => {
    expect(provider.isSimulated).toBe(true);
  });
});

describe('PayoutProviderRegistry', () => {
  afterEach(() => delete process.env.PAYOUT_PROVIDER);

  it('simulé par défaut', () => {
    expect(new PayoutProviderRegistry(new SimulatedPayoutProvider()).get().isSimulated).toBe(true);
  });

  it('une valeur inconnue ne fait jamais partir d\'argent par un autre canal : retour à la simulation', () => {
    process.env.PAYOUT_PROVIDER = 'inconnu';
    expect(new PayoutProviderRegistry(new SimulatedPayoutProvider()).get().isSimulated).toBe(true);
  });
});
