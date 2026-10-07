// backend/src/wallets/payouts.service.validation.spec.ts
// Mode Automatique / Manuel des retraits : en manuel, le retrait attend la validation de l'admin (qui est alerté par la cloche ET
// par email), puis il le valide (envoi par le prestataire), le passe en traitement, le marque payé ou le refuse — et le conducteur
// est prévenu à chaque décision.
import { BadRequestException } from '@nestjs/common';
import { NotificationType, PayoutStatus } from '@prisma/client';
import { PayoutsService } from './payouts.service';
import type { DisburseOutcome } from './providers/payout-provider.interface';

const WALLET = { id: 'w1', driverId: 'dr1', currencyId: 'xof', currency: { isoCode: 'XOF' } };

function build(options: {
  status?: PayoutStatus;
  destination?: string | null;
  settings?: { enabled?: boolean; max?: number };
  outcome?: DisburseOutcome | Error;
  claimCount?: number;
  simulated?: boolean;
  pendingCount?: number;
} = {}) {
  const state: Record<string, unknown> = {
    id: 'p1', walletId: 'w1', amount: 15_000n, currencyId: 'xof',
    status: options.status ?? PayoutStatus.REQUESTED, method: 'orange_money',
    destinationRef: options.destination === undefined ? '+224620004417' : options.destination,
    externalReference: null, failureReason: null, autoProcessed: false,
  };
  const settingRows = [
    ...(options.settings?.enabled === undefined ? [] : [{ key: 'payout.auto_enabled', value: options.settings.enabled }]),
    ...(options.settings?.max === undefined ? [] : [{ key: 'payout.auto_max_amount', value: options.settings.max }]),
  ];
  const disburse = jest.fn().mockImplementation(() =>
    options.outcome instanceof Error ? Promise.reject(options.outcome) : Promise.resolve(options.outcome ?? { status: 'PAID', externalReference: 'REF-1' }),
  );
  const prisma = {
    payout: {
      create: jest.fn().mockImplementation(() => Promise.resolve({ ...state })),
      findUnique: jest.fn().mockImplementation(() => Promise.resolve({ ...state })),
      findUniqueOrThrow: jest.fn().mockImplementation(() => Promise.resolve({ ...state })),
      count: jest.fn().mockResolvedValue(options.pendingCount ?? 0),
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
    platformSetting: {
      findMany: jest.fn().mockResolvedValue(settingRows),
      upsert: jest.fn().mockResolvedValue({ id: 'setting1' }),
    },
    wallet: { findUniqueOrThrow: jest.fn().mockResolvedValue(WALLET) },
    driverProfile: { findUnique: jest.fn().mockResolvedValue({ userId: 'u-driver' }) },
  };
  const wallets = {
    findByDriverId: jest.fn().mockResolvedValue(WALLET),
    reserveForPayout: jest.fn().mockResolvedValue(undefined),
    finalizePayout: jest.fn().mockResolvedValue(undefined),
    reversePayout: jest.fn().mockResolvedValue(undefined),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined), notifyStaff: jest.fn().mockResolvedValue(undefined) };
  const providers = { get: () => ({ isSimulated: options.simulated ?? false, disburse }) };
  const service = new PayoutsService(prisma as never, audit as never, wallets as never, providers as never, notifications as never);
  return { service, prisma, wallets, audit, notifications, disburse, state };
}

const request = (service: PayoutsService) =>
  service.request('dr1', { amount: '15000', method: 'orange_money', destinationRef: '+224620004417' } as never);

describe('Mode Manuel — le retrait attend la validation de l\'admin, qui est alerté', () => {
  it('le retrait reste « en attente de validation », les fonds sont réservés, rien n\'est envoyé', async () => {
    const { service, disburse, wallets } = build({ settings: { enabled: false } });
    const result = await request(service);
    expect(result.status).toBe(PayoutStatus.REQUESTED);
    expect(wallets.reserveForPayout).toHaveBeenCalledTimes(1);
    expect(disburse).not.toHaveBeenCalled();
  });

  it('alerte l\'équipe qui gère les retraits : cloche ET email, avec le montant et le rappel de vérifier le compte Orange Money', async () => {
    const { service, notifications } = build({ settings: { enabled: false } });
    await request(service);
    expect(notifications.notifyStaff).toHaveBeenCalledTimes(1);
    const alert = notifications.notifyStaff.mock.calls[0][0];
    expect(alert).toMatchObject({
      permission: 'payout.manage',
      type: NotificationType.DRIVER_PAYMENT,
      title: 'Retrait à valider',
      link: '/payouts',
      email: true,
      payload: { payoutId: 'p1' },
    });
    expect(alert.body.replace(/\s/g, ' ')).toContain('15 000 XOF');
    expect(alert.body).toContain('Orange Money');
  });

  it('montant au-dessus du plafond du mode automatique : même alerte', async () => {
    const { service, notifications, disburse } = build({ settings: { enabled: true, max: 10_000 } });
    await request(service);
    expect(disburse).not.toHaveBeenCalled();
    expect(notifications.notifyStaff).toHaveBeenCalledTimes(1);
  });

  it('une alerte qui échoue ne fait pas échouer la demande du conducteur', async () => {
    const { service, notifications } = build({ settings: { enabled: false } });
    notifications.notifyStaff.mockRejectedValue(new Error('email indisponible'));
    await expect(request(service)).resolves.toMatchObject({ status: PayoutStatus.REQUESTED });
  });

  it('Mode Automatique : aucune alerte à l\'équipe (le retrait part tout seul)', async () => {
    const { service, notifications, disburse } = build();
    const result = await request(service);
    expect(disburse).toHaveBeenCalledTimes(1);
    expect(result.status).toBe(PayoutStatus.PAID);
    expect(notifications.notifyStaff).not.toHaveBeenCalled();
  });
});

describe('PayoutsService.approve — « Valider et envoyer »', () => {
  it('envoie le virement par le prestataire, marque payé au nom de l\'admin et décompte le solde en attente', async () => {
    const { service, disburse, wallets, audit, prisma } = build();
    const result = await service.approve('p1', 'admin1');
    expect(disburse).toHaveBeenCalledWith({
      reference: 'p1', amount: 15_000n, currencyIsoCode: 'XOF', method: 'orange_money', destination: '+224620004417',
    });
    expect(wallets.finalizePayout).toHaveBeenCalledTimes(1);
    expect(result.status).toBe(PayoutStatus.PAID);
    // Validé par un humain : pas marqué « traité automatiquement ».
    expect(prisma.payout.updateMany.mock.calls[0][0].data).toMatchObject({ status: PayoutStatus.PROCESSING, autoProcessed: false });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'admin1', action: 'APPROVED' }));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'admin1', action: 'PAID' }));
  });

  it('prévient le conducteur, numéro masqué', async () => {
    const { service, notifications } = build();
    await service.approve('p1', 'admin1');
    const { fallbackTitle, fallbackBody, userId } = notifications.notify.mock.calls[0][0];
    expect(userId).toBe('u-driver');
    expect(fallbackTitle).toBe('Retrait effectué');
    expect(fallbackBody).toContain('••••4417');
    expect(fallbackBody).not.toContain('620004417');
  });

  it('refus du prestataire : retrait échoué, solde remis au conducteur, conducteur prévenu', async () => {
    const { service, wallets, notifications } = build({ outcome: { status: 'FAILED', reason: 'Compte Orange Money sans unités' } });
    const result = await service.approve('p1', 'admin1');
    expect(result.status).toBe(PayoutStatus.FAILED);
    expect(wallets.reversePayout).toHaveBeenCalledTimes(1);
    expect(wallets.finalizePayout).not.toHaveBeenCalled();
    expect(notifications.notify.mock.calls[0][0].fallbackTitle).toBe('Retrait refusé');
  });

  it('prestataire asynchrone : le retrait reste « en cours » et le conducteur est prévenu que sa demande est validée', async () => {
    const { service, wallets, notifications } = build({ outcome: { status: 'PROCESSING', externalReference: 'REF-ASYNC' } });
    const result = await service.approve('p1', 'admin1');
    expect(result.status).toBe(PayoutStatus.PROCESSING);
    expect(wallets.finalizePayout).not.toHaveBeenCalled();
    expect(wallets.reversePayout).not.toHaveBeenCalled();
    expect(notifications.notify.mock.calls[0][0].fallbackTitle).toBe('Retrait validé');
  });

  it('erreur technique (résultat inconnu) : JAMAIS remboursé ni marqué payé, laissé « en cours » et tracé', async () => {
    const { service, wallets, audit, notifications } = build({ outcome: new Error('timeout réseau') });
    const result = await service.approve('p1', 'admin1');
    expect(result.status).toBe(PayoutStatus.PROCESSING);
    expect(wallets.reversePayout).not.toHaveBeenCalled();
    expect(wallets.finalizePayout).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'admin1', action: 'APPROVED_ERROR' }));
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it.each([PayoutStatus.PROCESSING, PayoutStatus.PAID, PayoutStatus.FAILED, PayoutStatus.CANCELLED])(
    'refusé sur un retrait déjà « %s » : rien n\'est envoyé',
    async (status) => {
      const { service, disburse } = build({ status });
      await expect(service.approve('p1', 'admin1')).rejects.toBeInstanceOf(BadRequestException);
      expect(disburse).not.toHaveBeenCalled();
    },
  );

  it('retrait sans numéro Mobile Money : refusé plutôt qu\'un envoi dans le vide', async () => {
    const { service, disburse } = build({ destination: null });
    await expect(service.approve('p1', 'admin1')).rejects.toBeInstanceOf(BadRequestException);
    expect(disburse).not.toHaveBeenCalled();
  });

  it('double clic / deux admins en même temps : un seul envoi', async () => {
    const { service, disburse } = build({ claimCount: 0 });
    await expect(service.approve('p1', 'admin1')).rejects.toThrow('déjà été pris en charge');
    expect(disburse).not.toHaveBeenCalled();
  });

  describe('prestataire simulé (Orange Money pas encore branché)', () => {
    const previous = process.env.NODE_ENV;
    afterEach(() => {
      process.env.NODE_ENV = previous;
    });

    it('en production : refusé, car « envoyer » marquerait payé sans qu\'aucun argent ne parte', async () => {
      process.env.NODE_ENV = 'production';
      const { service, disburse } = build({ simulated: true });
      await expect(service.approve('p1', 'admin1')).rejects.toThrow("Orange Money n'est pas encore branché");
      expect(disburse).not.toHaveBeenCalled();
    });

    it('hors production : autorisé, pour tester le parcours', async () => {
      process.env.NODE_ENV = 'test';
      const { service, disburse } = build({ simulated: true });
      await service.approve('p1', 'admin1');
      expect(disburse).toHaveBeenCalledTimes(1);
    });
  });
});

describe('Décisions de l\'équipe — le conducteur est toujours prévenu', () => {
  it('« Passer en traitement » (validation, virement fait par l\'admin) : retrait validé', async () => {
    const { service, notifications } = build();
    await service.markProcessing('p1', 'admin1');
    const { fallbackTitle, fallbackBody } = notifications.notify.mock.calls[0][0];
    expect(fallbackTitle).toBe('Retrait validé');
    expect(fallbackBody.replace(/\s/g, ' ')).toContain('15 000 XOF');
  });

  it('« Marquer payé » : retrait effectué', async () => {
    const { service, notifications, wallets } = build({ status: PayoutStatus.PROCESSING });
    await service.markPaid('p1', 'admin1');
    expect(wallets.finalizePayout).toHaveBeenCalledTimes(1);
    expect(notifications.notify.mock.calls[0][0].fallbackTitle).toBe('Retrait effectué');
  });

  it('Refus : solde remis au conducteur, motif de l\'admin dans le message', async () => {
    const { service, notifications, wallets } = build();
    await service.markFailed('p1', 'Numéro Mobile Money invalide', 'admin1');
    expect(wallets.reversePayout).toHaveBeenCalledTimes(1);
    const { fallbackTitle, fallbackBody } = notifications.notify.mock.calls[0][0];
    expect(fallbackTitle).toBe('Retrait refusé');
    expect(fallbackBody).toContain('Numéro Mobile Money invalide');
    expect(fallbackBody).toContain('remis dans votre solde');
  });

  it('retrait déjà clôturé : erreur, et aucun message au conducteur', async () => {
    const { service, notifications } = build({ status: PayoutStatus.PAID, claimCount: 0 });
    await expect(service.markFailed('p1', 'trop tard', 'admin1')).rejects.toBeInstanceOf(BadRequestException);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('une notification qui échoue ne défait pas la décision', async () => {
    const { service, notifications, wallets } = build({ status: PayoutStatus.PROCESSING });
    notifications.notify.mockRejectedValue(new Error('push indisponible'));
    await expect(service.markPaid('p1', 'admin1')).resolves.toMatchObject({ status: PayoutStatus.PAID });
    expect(wallets.finalizePayout).toHaveBeenCalledTimes(1);
  });
});

describe('Mode des retraits — lecture et bascule', () => {
  it('getConfig : mode, plafond (en texte), état du prestataire et retraits à valider', async () => {
    const { service } = build({ settings: { enabled: false, max: 250_000 }, simulated: true, pendingCount: 3 });
    await expect(service.getConfig()).resolves.toEqual({
      autoEnabled: false,
      autoMaxAmount: '250000',
      providerSimulated: true,
      pendingCount: 3,
    });
  });

  it('getConfig sans réglage enregistré : automatique, aucun plafond (comportement par défaut)', async () => {
    const { service } = build();
    await expect(service.getConfig()).resolves.toMatchObject({ autoEnabled: true, autoMaxAmount: '0' });
  });

  it('getConfig : le compteur de retraits à valider respecte la portée par pays de l\'équipier', async () => {
    const { service, prisma } = build();
    const scope = { wallet: { driver: { countryId: { in: ['gn'] } } } };
    await service.getConfig(scope as never);
    expect(prisma.payout.count).toHaveBeenCalledWith({ where: { AND: [{ status: PayoutStatus.REQUESTED }, scope] } });
  });

  it('setMode écrit le réglage « payout.auto_enabled » et trace qui l\'a changé', async () => {
    const { service, prisma, audit } = build();
    await service.setMode(false, 'admin1');
    expect(prisma.platformSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: 'payout.auto_enabled' },
        update: { value: false, updatedById: 'admin1' },
        create: expect.objectContaining({ key: 'payout.auto_enabled', value: false, updatedById: 'admin1' }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'admin1', entityType: 'PlatformSetting', action: 'UPSERT', diff: { key: 'payout.auto_enabled', value: false } }),
    );
  });
});
