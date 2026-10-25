// backend/src/wallets/payouts.service.auto.spec.ts
// Retrait automatique : envoyé tout de suite au prestataire, sans validation de l'équipe — avec la validation manuelle en option.
import { PayoutStatus } from '@prisma/client';
import { PayoutsService } from './payouts.service';
import type { DisburseOutcome } from './providers/payout-provider.interface';

const WALLET = { id: 'w1', driverId: 'dr1', currencyId: 'xof', currency: { isoCode: 'XOF' } };

function build(options: {
  amount?: bigint;
  destination?: string | null;
  settings?: { enabled?: boolean; max?: number | null; delayMinutes?: number };
  outcome?: DisburseOutcome | Error;
  claimCount?: number;
  reserveFails?: boolean;
  /** Raison renvoyée par les garde-fous (ex. NOUVELLE_DESTINATION) : impose la validation manuelle. */
  manualReason?: string | null;
  simulated?: boolean;
} = {}) {
  // Le retrait vit dans `state` : chaque réclamation de statut le modifie, comme la base de données le ferait.
  const state: Record<string, unknown> = {
    id: 'p1', walletId: 'w1', amount: options.amount ?? 15_000n, currencyId: 'xof',
    status: PayoutStatus.REQUESTED, method: 'orange_money',
    destinationRef: options.destination === undefined ? '+224620004417' : options.destination,
    externalReference: null, failureReason: null, autoProcessed: false, autoReleaseAt: null,
  };
  const settingRows = [
    ...(options.settings?.enabled === undefined ? [] : [{ key: 'payout.auto_enabled', value: options.settings.enabled }]),
    ...(options.settings?.max == null ? [] : [{ key: 'payout.auto_max_amount', value: options.settings.max }]),
    ...(options.settings?.delayMinutes === undefined ? [] : [{ key: 'payout.new_destination_delay_minutes', value: options.settings.delayMinutes }]),
  ];
  const disburse = jest.fn().mockImplementation(() =>
    options.outcome instanceof Error ? Promise.reject(options.outcome) : Promise.resolve(options.outcome ?? { status: 'PAID', externalReference: 'REF-1' }),
  );
  const prisma = {
    payout: {
      create: jest.fn().mockImplementation(() => Promise.resolve({ ...state })),
      findUnique: jest.fn().mockImplementation(() => Promise.resolve({ ...state })),
      findUniqueOrThrow: jest.fn().mockImplementation(() => Promise.resolve({ ...state })),
      findMany: jest.fn().mockImplementation(() =>
        Promise.resolve(
          state.status === PayoutStatus.REQUESTED && state.autoReleaseAt && (state.autoReleaseAt as Date).getTime() <= Date.now() ? [{ ...state }] : [],
        ),
      ),
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
    wallet: { findUniqueOrThrow: jest.fn().mockResolvedValue(WALLET), findUnique: jest.fn().mockResolvedValue(WALLET) },
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
  const providers = { get: () => ({ isSimulated: options.simulated ?? true, disburse }) };
  const service = new PayoutsService(prisma as never, audit as never, wallets as never, providers as never, notifications as never, { check: jest.fn().mockImplementation(({ rawAmount, rawDestination }: { rawAmount: string; rawDestination?: string }) => Promise.resolve({ amount: BigInt(rawAmount), destinationRef: rawDestination ?? null, manualReason: options.manualReason ?? null })) } as never);
  return { service, prisma, wallets, audit, notifications, disburse };
}

const request = (service: PayoutsService) => service.request('dr1', { amount: '15000', method: 'orange_money', destinationRef: '+224620004417' } as never);
const statusUpdates = (prisma: ReturnType<typeof build>['prisma']) => prisma.payout.updateMany.mock.calls.map((c) => c[0].data.status);

describe('PayoutsService.request — nouveau numéro (le mode automatique n\'attend pas l\'équipe)', () => {
  it('NOUVEAU numéro : programmé avec un délai de sécurité (60 min par défaut), conducteur prévenu, équipe NON sollicitée, fonds réservés', async () => {
    const { service, disburse, audit, wallets, notifications } = build({ manualReason: 'NOUVELLE_DESTINATION' });
    const before = Date.now();
    const result = await request(service);
    expect(disburse).not.toHaveBeenCalled();
    expect(result.status).toBe(PayoutStatus.REQUESTED);
    const releaseAt = (result as unknown as { autoReleaseAt: Date }).autoReleaseAt.getTime();
    expect(releaseAt - before).toBeGreaterThan(59 * 60_000);
    expect(releaseAt - before).toBeLessThan(61 * 60_000);
    expect(wallets.reserveForPayout).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'AUTO_DELAYED' }));
    // seul le conducteur est prévenu : l'équipe n'a rien à faire (pas de cloche « Retrait à valider »)
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect((notifications as unknown as { notifyStaff?: jest.Mock }).notifyStaff).toBeUndefined();
  });

  it('délai réglé à 0 : le nouveau numéro est payé tout de suite', async () => {
    const { service, disburse } = build({ manualReason: 'NOUVELLE_DESTINATION', settings: { delayMinutes: 0 } });
    const result = await request(service);
    expect(disburse).toHaveBeenCalledTimes(1);
    expect(result.status).toBe(PayoutStatus.PAID);
  });

  it('mode MANUEL : le nouveau numéro n\'est pas programmé, il attend l\'équipe', async () => {
    const { service, disburse } = build({ manualReason: 'NOUVELLE_DESTINATION', settings: { enabled: false } });
    const result = await request(service);
    expect(disburse).not.toHaveBeenCalled();
    expect((result as unknown as { autoReleaseAt: unknown }).autoReleaseAt).toBeNull();
  });

  it('autre garde-fou imposé : toujours la validation de l\'équipe', async () => {
    const { service, disburse, audit } = build({ manualReason: 'AUTRE_RAISON' });
    await request(service);
    expect(disburse).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'AUTO_SKIPPED', diff: { reason: 'AUTRE_RAISON' } }));
  });
});

describe('PayoutsService.releaseDue — envoi à l\'échéance du délai de sécurité', () => {
  const dueNow = (state: Record<string, unknown>) => { state.autoReleaseAt = new Date(Date.now() - 1_000); };

  it('envoie tout seul, sans équipe, quand le délai est écoulé', async () => {
    const { service, disburse, prisma } = build({ manualReason: 'NOUVELLE_DESTINATION' });
    const created = await request(service);
    expect(disburse).not.toHaveBeenCalled();
    // le délai est écoulé
    const row = await prisma.payout.findUnique();
    expect(row.status).toBe(PayoutStatus.REQUESTED);
    await prisma.payout.update({ data: { autoReleaseAt: new Date(Date.now() - 1_000) } });
    expect(created.status).toBe(PayoutStatus.REQUESTED);
    await expect(service.releaseDue()).resolves.toBe(1);
    expect(disburse).toHaveBeenCalledTimes(1);
    const after = await prisma.payout.findUnique();
    expect(after.status).toBe(PayoutStatus.PAID);
  });

  it('délai pas encore écoulé : rien ne part', async () => {
    const { service, disburse } = build({ manualReason: 'NOUVELLE_DESTINATION' });
    await request(service);
    await expect(service.releaseDue()).resolves.toBe(0);
    expect(disburse).not.toHaveBeenCalled();
  });

  it('mode passé en manuel entre-temps : le compte à rebours s\'arrête et l\'équipe est alertée', async () => {
    const { service, disburse, prisma } = build({ manualReason: 'NOUVELLE_DESTINATION' });
    await request(service);
    await prisma.payout.update({ data: { autoReleaseAt: new Date(Date.now() - 1_000) } });
    prisma.platformSetting.findMany.mockResolvedValue([{ key: 'payout.auto_enabled', value: false }]);
    const notifyStaff = jest.fn().mockResolvedValue(undefined);
    (service as unknown as { notifications: { notifyStaff: jest.Mock } }).notifications.notifyStaff = notifyStaff;
    await expect(service.releaseDue()).resolves.toBe(0);
    expect(disburse).not.toHaveBeenCalled();
    expect(notifyStaff).toHaveBeenCalledTimes(1);
    expect((await prisma.payout.findUnique()).autoReleaseAt).toBeNull();
  });
});

describe('PayoutsService.cancelByDriver', () => {
  it('annule un retrait programmé et rend les fonds au conducteur', async () => {
    const { service, wallets, disburse, prisma } = build({ manualReason: 'NOUVELLE_DESTINATION' });
    await request(service);
    const result = await service.cancelByDriver('p1', 'dr1');
    expect(result.status).toBe(PayoutStatus.CANCELLED);
    expect(wallets.reversePayout).toHaveBeenCalledWith('dr1', 15_000n, 'p1');
    // un retrait annulé n'est plus jamais envoyé
    await prisma.payout.update({ data: { autoReleaseAt: new Date(Date.now() - 1_000) } });
    await expect(service.releaseDue()).resolves.toBe(0);
    expect(disburse).not.toHaveBeenCalled();
  });

  it('impossible une fois l\'envoi lancé : les fonds ne sont pas rendus', async () => {
    const { service, wallets } = build({ outcome: { status: 'PROCESSING', externalReference: 'R' } as never });
    await request(service);
    await expect(service.cancelByDriver('p1', 'dr1')).rejects.toThrow(/ne peut plus être annulé/);
    expect(wallets.reversePayout).not.toHaveBeenCalled();
  });

  it('refuse le retrait d\'un autre conducteur', async () => {
    const { service, wallets } = build({ manualReason: 'NOUVELLE_DESTINATION' });
    await request(service);
    wallets.findByDriverId.mockResolvedValueOnce({ ...WALLET, id: 'w-autre' });
    await expect(service.cancelByDriver('p1', 'autre')).rejects.toThrow(/introuvable/);
  });

  it('les fonds n\'ont pas pu être rendus : le retrait est rouvert pour réessayer', async () => {
    const { service, wallets, prisma } = build({ manualReason: 'NOUVELLE_DESTINATION' });
    await request(service);
    wallets.reversePayout.mockRejectedValueOnce(new Error('conflit'));
    await expect(service.cancelByDriver('p1', 'dr1')).rejects.toThrow('conflit');
    expect((await prisma.payout.findUnique()).status).toBe(PayoutStatus.REQUESTED);
  });
});

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
