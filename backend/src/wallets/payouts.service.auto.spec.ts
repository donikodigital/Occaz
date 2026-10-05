// backend/src/wallets/payouts.service.auto.spec.ts
// Retrait automatique : envoyé tout de suite au prestataire, sans validation de l'équipe — avec la validation manuelle en option.
import { PayoutStatus } from '@prisma/client';
import { PayoutsService } from './payouts.service';
import type { DisburseOutcome } from './providers/payout-provider.interface';

const WALLET = { id: 'w1', driverId: 'dr1', currencyId: 'xof', currency: { isoCode: 'XOF' } };

function build(options: {
  amount?: bigint;
  destination?: string | null;
  settings?: { enabled?: boolean; max?: number | null };
  outcome?: DisburseOutcome | Error;
  claimCount?: number;
  reserveFails?: boolean;
} = {}) {
  // Le retrait vit dans `state` : chaque réclamation de statut le modifie, comme la base de données le ferait.
  const state: Record<string, unknown> = {
    id: 'p1', walletId: 'w1', amount: options.amount ?? 15_000n, currencyId: 'xof',
    status: PayoutStatus.REQUESTED, method: 'orange_money',
    destinationRef: options.destination === undefined ? '+224620004417' : options.destination,
    externalReference: null, failureReason: null, autoProcessed: false,
  };
  const settingRows = [
    ...(options.settings?.enabled === undefined ? [] : [{ key: 'payout.auto_enabled', value: options.settings.enabled }]),
    ...(options.settings?.max == null ? [] : [{ key: 'payout.auto_max_amount', value: options.settings.max }]),
  ];
  const disburse = jest.fn().mockImplementation(() =>
    options.outcome instanceof Error ? Promise.reject(options.outcome) : Promise.resolve(options.outcome ?? { status: 'PAID', externalReference: 'REF-1' }),
  );
  const prisma = {
    payout: {
      create: jest.fn().mockImplementation(() => Promise.resolve({ ...state })),
      findUnique: jest.fn().mockImplementation(() => Promise.resolve({ ...state })),
      findUniqueOrThrow: jest.fn().mockImplementation(() => Promise.resolve({ ...state })),
      updateMany: jest.fn().mockImplementation(({ where, data }: { where: { status: unknown }; data: Record<string, unknown> }) => {
        if (options.claimCount === 0) return Promise.resolve({ count: 0 });
        const allowed = (where.status as { in?: unknown[] }).in ?? [where.status];
        if (!allowed.includes(state.status)) return Promise.resolve({ count: 0 });
        Object.assign(state, data);
        return Promise.resolve({ count: 1 });
      }),
      update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        Object.assign(state, data);
        return Promise.resolve({ ...state });
      }),
    },
    platformSetting: { findMany: jest.fn().mockResolvedValue(settingRows) },
    wallet: { findUniqueOrThrow: jest.fn().mockResolvedValue(WALLET) },
    driverProfile: { findUnique: jest.fn().mockResolvedValue({ userId: 'u-driver' }) },
  };
  const wallets = {
    findByDriverId: jest.fn().mockResolvedValue(WALLET),
    reserveForPayout: options.reserveFails ? jest.fn().mockRejectedValue(new Error('Solde insuffisant')) : jest.fn().mockResolvedValue(undefined),
    finalizePayout: jest.fn().mockResolvedValue(undefined),
    reversePayout: jest.fn().mockResolvedValue(undefined),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const providers = { get: () => ({ isSimulated: true, disburse }) };
  const service = new PayoutsService(prisma as never, audit as never, wallets as never, providers as never, notifications as never);
  return { service, prisma, wallets, audit, notifications, disburse };
}

const request = (service: PayoutsService) => service.request('dr1', { amount: '15000', method: 'orange_money', destinationRef: '+224620004417' } as never);
const statusUpdates = (prisma: ReturnType<typeof build>['prisma']) => prisma.payout.updateMany.mock.calls.map((c) => c[0].data.status);

describe('PayoutsService.request — retrait automatique (par défaut)', () => {
  it('envoie le virement tout de suite au prestataire avec le retrait comme clé d\'idempotence, sans validation de l\'équipe', async () => {
    const { service, disburse, wallets } = build();
    const result = await request(service);
    expect(disburse).toHaveBeenCalledWith({
      reference: 'p1', amount: 15_000n, currencyIsoCode: 'XOF', method: 'orange_money', destination: '+224620004417',
    });
    expect(wallets.finalizePayout).toHaveBeenCalledTimes(1); // solde en attente décompté
    expect(result.status).toBe(PayoutStatus.PAID);
  });

  it('marque le retrait « traité automatiquement » et garde la référence du prestataire', async () => {
    const { service, prisma } = build();
    await request(service);
    expect(prisma.payout.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: 'p1', status: PayoutStatus.REQUESTED },
      data: { status: PayoutStatus.PROCESSING, autoProcessed: true },
    });
    expect(prisma.payout.updateMany.mock.calls[1][0].data).toMatchObject({ status: PayoutStatus.PAID, externalReference: 'REF-1' });
  });

  it('prévient le conducteur, montant avec sa devise et numéro masqué', async () => {
    const { service, notifications } = build();
    await request(service);
    const { fallbackTitle, fallbackBody, userId } = notifications.notify.mock.calls[0][0];
    expect(userId).toBe('u-driver');
    expect(fallbackTitle).toBe('Retrait effectué');
    expect(fallbackBody.replace(/\s/g, ' ')).toBe('15 000 XOF ont été envoyés sur votre compte Mobile Money (••••4417).');
    expect(fallbackBody).not.toContain('620004417'); // jamais le numéro entier
  });

  it('refus du prestataire : retrait échoué, solde remis au conducteur, raison enregistrée, conducteur prévenu', async () => {
    const { service, prisma, wallets, notifications } = build({ outcome: { status: 'FAILED', reason: 'Numéro Mobile Money refusé' } });
    await request(service);
    expect(wallets.reversePayout).toHaveBeenCalledTimes(1);
    expect(wallets.finalizePayout).not.toHaveBeenCalled();
    expect(prisma.payout.updateMany.mock.calls[1][0].data).toMatchObject({ status: PayoutStatus.FAILED, failureReason: 'Numéro Mobile Money refusé' });
    expect(notifications.notify.mock.calls[0][0].fallbackTitle).toBe('Retrait refusé');
    expect(notifications.notify.mock.calls[0][0].fallbackBody).toContain('remis dans votre solde');
  });

  it('prestataire asynchrone (accepté, pas encore confirmé) : le retrait reste « en cours », rien n\'est décompté ni remboursé', async () => {
    const { service, prisma, wallets } = build({ outcome: { status: 'PROCESSING', externalReference: 'REF-ASYNC' } });
    await request(service);
    expect(wallets.finalizePayout).not.toHaveBeenCalled();
    expect(wallets.reversePayout).not.toHaveBeenCalled();
    expect(statusUpdates(prisma)).toEqual([PayoutStatus.PROCESSING]); // seule la réclamation initiale
    expect(prisma.payout.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { externalReference: 'REF-ASYNC' } });
  });

  it('erreur technique (résultat inconnu) : JAMAIS remboursé ni marqué payé, retrait laissé « en cours » pour vérification', async () => {
    const { service, wallets, audit, notifications } = build({ outcome: new Error('timeout réseau') });
    await expect(request(service)).resolves.toBeDefined(); // aucune erreur renvoyée au conducteur
    expect(wallets.reversePayout).not.toHaveBeenCalled();
    expect(wallets.finalizePayout).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'AUTO_ERROR', diff: { message: 'timeout réseau' } }));
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('une notification qui échoue ne défait pas un retrait déjà payé', async () => {
    const built = build();
    built.notifications.notify.mockRejectedValue(new Error('push indisponible'));
    const result = await request(built.service);
    expect(result.status).toBe(PayoutStatus.PAID);
    expect(built.wallets.finalizePayout).toHaveBeenCalledTimes(1);
  });
});

describe('PayoutsService — validation manuelle en option', () => {
  it('réglage « retrait automatique » coupé : le retrait attend l\'équipe, rien n\'est envoyé', async () => {
    const { service, disburse, prisma } = build({ settings: { enabled: false } });
    const result = await request(service);
    expect(disburse).not.toHaveBeenCalled();
    expect(prisma.payout.updateMany).not.toHaveBeenCalled();
    expect(result.status).toBe(PayoutStatus.REQUESTED);
  });

  it('réglage absent : automatique (comportement par défaut)', async () => {
    const { service, disburse } = build({ settings: {} });
    await request(service);
    expect(disburse).toHaveBeenCalledTimes(1);
  });

  it('montant au-dessus du plafond : validation manuelle, et le motif est tracé pour l\'équipe', async () => {
    const { service, disburse, audit } = build({ amount: 300_000n, settings: { max: 250_000 } });
    await request(service);
    expect(disburse).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'AUTO_SKIPPED', diff: { reason: 'MONTANT_AU_DESSUS_DU_PLAFOND' } }));
  });

  it('montant égal au plafond : automatique ; plafond 0 : aucune limite', async () => {
    const equal = build({ amount: 250_000n, settings: { max: 250_000 } });
    await request(equal.service);
    expect(equal.disburse).toHaveBeenCalledTimes(1);
    const unlimited = build({ amount: 99_999_999n, settings: { max: 0 } });
    await request(unlimited.service);
    expect(unlimited.disburse).toHaveBeenCalledTimes(1);
  });

  it('numéro de destination manquant : validation manuelle plutôt qu\'un envoi dans le vide', async () => {
    const { service, disburse, audit } = build({ destination: null });
    await request(service);
    expect(disburse).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'AUTO_SKIPPED', diff: { reason: 'DESTINATION_MANQUANTE' } }));
  });

  it('retrait déjà pris en charge par l\'équipe entre-temps : rien n\'est envoyé en double', async () => {
    const { service, disburse } = build({ claimCount: 0 });
    await request(service);
    expect(disburse).not.toHaveBeenCalled();
  });

  it('l\'équipe garde ses actions : markPaid et markFailed fonctionnent toujours (retrait bloqué), avec la raison du refus enregistrée', async () => {
    const paid = build();
    await paid.service.markPaid('p1', 'admin');
    expect(paid.wallets.finalizePayout).toHaveBeenCalledTimes(1);
    const failed = build();
    await failed.service.markFailed('p1', 'Numéro erroné', 'admin');
    expect(failed.wallets.reversePayout).toHaveBeenCalledTimes(1);
    expect(failed.prisma.payout.updateMany.mock.calls[0][0].data).toMatchObject({ status: PayoutStatus.FAILED, failureReason: 'Numéro erroné' });
  });
});

describe('PayoutsService.request — la réservation des fonds reste préalable', () => {
  it('solde insuffisant : demande annulée, aucun envoi au prestataire', async () => {
    const { service, disburse, prisma } = build({ reserveFails: true });
    await expect(request(service)).rejects.toThrow('Solde insuffisant');
    expect(disburse).not.toHaveBeenCalled();
    expect(prisma.payout.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { status: PayoutStatus.CANCELLED } });
  });
});
