// Portefeuille plateforme : le solde vient du registre des commissions, un retrait ne dépasse jamais le disponible, ne part que vers
// un bénéficiaire enregistré, après confirmation du mot de passe, et un résultat inconnu ne rembourse jamais tout seul.
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PlatformWithdrawalStatus } from '@prisma/client';
import { PlatformWalletService } from './platform-wallet.service';
import type { DisburseOutcome } from '../wallets/providers/payout-provider.interface';

const PASSWORD = 'Secret#123';
const BENEFICIARY = { id: 'b1', label: 'Mon Orange Money', isActive: true, method: 'orange_money', phone: '+224620004417' };
const XOF = { id: 'xof', isoCode: 'XOF' };

function build(options: {
  earned?: bigint; // commissions libérées (positif côté plateforme)
  pending?: bigint;
  paid?: bigint;
  processing?: bigint;
  outcome?: DisburseOutcome | Error;
  beneficiary?: typeof BENEFICIARY | null;
  simulated?: boolean;
} = {}) {
  const state: Record<string, unknown> = {};
  const commissionSum = (status: string) => (status === 'COMPLETED' ? -(options.earned ?? 100_000n) : -(options.pending ?? 0n));
  const withdrawalSum = (status: string) => (status === 'PAID' ? (options.paid ?? 0n) : (options.processing ?? 0n));
  const prisma = {
    currency: { findUnique: jest.fn().mockResolvedValue(XOF), findMany: jest.fn().mockResolvedValue([XOF]) },
    walletTransaction: {
      aggregate: jest.fn().mockImplementation(({ where }: { where: { status: string } }) => Promise.resolve({ _sum: { amount: commissionSum(where.status) } })),
    },
    platformWithdrawal: {
      aggregate: jest.fn().mockImplementation(({ where }: { where: { status: string } }) => Promise.resolve({ _sum: { amount: withdrawalSum(where.status) } })),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        Object.assign(state, { id: 'w1', ...data });
        return Promise.resolve({ ...state });
      }),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockImplementation(({ where, data }: { where: { status: string }; data: Record<string, unknown> }) => {
        if (state.status !== where.status) return Promise.resolve({ count: 0 });
        Object.assign(state, data);
        return Promise.resolve({ count: 1 });
      }),
      findUnique: jest.fn().mockImplementation(() =>
        Promise.resolve({ ...state, amount: state.amount ?? 5_000n, destinationRef: '+224620004417', currency: XOF, beneficiary: BENEFICIARY }),
      ),
    },
    platformBeneficiary: {
      findUnique: jest.fn().mockResolvedValue(options.beneficiary === undefined ? BENEFICIARY : options.beneficiary),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ passwordHash: bcrypt.hashSync(PASSWORD, 4) }) },
    $executeRaw: jest.fn().mockResolvedValue(1),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prisma));
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const notifications = { notifyStaff: jest.fn().mockResolvedValue(undefined) };
  const disburse = jest.fn().mockImplementation(() =>
    options.outcome instanceof Error ? Promise.reject(options.outcome) : Promise.resolve(options.outcome ?? { status: 'PAID', externalReference: 'REF-1' }),
  );
  const providers = { get: () => ({ isSimulated: options.simulated ?? false, disburse }) };
  const service = new PlatformWalletService(prisma as never, audit as never, notifications as never, providers as never);
  return { service, prisma, audit, notifications, disburse, state };
}

const dto = (over: Record<string, unknown> = {}) => ({ beneficiaryId: 'b1', currencyId: 'xof', amount: '5000', password: PASSWORD, ...over }) as never;

describe('PlatformWalletService — solde', () => {
  it('disponible = commissions libérées − retraits payés − retraits en cours ; les commissions en attente ne comptent pas', async () => {
    const { service } = build({ earned: 100_000n, pending: 30_000n, paid: 20_000n, processing: 10_000n });
    const { balances } = await service.getOverview();
    expect(balances[0]).toMatchObject({ isoCode: 'XOF', earned: '100000', pending: '30000', withdrawn: '20000', inProgress: '10000', available: '70000' });
  });
});

describe('PlatformWalletService.withdraw', () => {
  const OLD_ENV = process.env.NODE_ENV;
  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = OLD_ENV;
  });

  it('envoie le virement avec le retrait comme clé d\'idempotence puis le marque payé', async () => {
    const { service, disburse, state, audit } = build();
    await service.withdraw(dto(), 'admin1');
    expect(disburse).toHaveBeenCalledWith(expect.objectContaining({ reference: 'w1', amount: 5000n, currencyIsoCode: 'XOF', destination: '+224620004417' }));
    expect(state.status).toBe(PlatformWithdrawalStatus.PAID);
    expect(audit.log.mock.calls.map((c) => c[0].action)).toEqual(['REQUESTED', 'PAID']);
  });

  it('refuse un mauvais mot de passe sans toucher à l\'argent', async () => {
    const { service, prisma, disburse } = build();
    await expect(service.withdraw(dto({ password: 'faux' }), 'admin1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.platformWithdrawal.create).not.toHaveBeenCalled();
    expect(disburse).not.toHaveBeenCalled();
  });

  it('refuse un montant supérieur au disponible', async () => {
    const { service, prisma, disburse } = build({ earned: 4_000n });
    await expect(service.withdraw(dto(), 'admin1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.platformWithdrawal.create).not.toHaveBeenCalled();
    expect(disburse).not.toHaveBeenCalled();
  });

  it('prend le verrou de la devise avant de lire le solde', async () => {
    const { service, prisma } = build();
    await service.withdraw(dto(), 'admin1');
    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  it('refuse un bénéficiaire désactivé', async () => {
    const { service, disburse } = build({ beneficiary: { ...BENEFICIARY, isActive: false } });
    await expect(service.withdraw(dto(), 'admin1')).rejects.toBeInstanceOf(BadRequestException);
    expect(disburse).not.toHaveBeenCalled();
  });

  it('un refus du prestataire clôt le retrait en échec : le montant redevient disponible', async () => {
    const { service, state } = build({ outcome: { status: 'FAILED', reason: 'Numéro refusé' } });
    await service.withdraw(dto(), 'admin1');
    expect(state.status).toBe(PlatformWithdrawalStatus.FAILED);
    expect(state.failureReason).toBe('Numéro refusé');
  });

  it('un résultat inconnu (exception) laisse le retrait « en cours » : jamais de remboursement automatique', async () => {
    const { service, state, prisma } = build({ outcome: new Error('timeout') });
    await service.withdraw(dto(), 'admin1');
    expect(state.status).toBe(PlatformWithdrawalStatus.PROCESSING);
    expect(prisma.platformWithdrawal.updateMany).not.toHaveBeenCalled();
  });

  it('en production avec le prestataire simulé : le montant est réservé, aucun appel au prestataire (virement à la main)', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    const { service, disburse, state } = build({ simulated: true });
    await service.withdraw(dto(), 'admin1');
    expect(disburse).not.toHaveBeenCalled();
    expect(state.status).toBe(PlatformWithdrawalStatus.PROCESSING);
  });
});

describe('PlatformWalletService — retrait en cours', () => {
  it('marquer payé ne marche qu\'une fois', async () => {
    const { service, state } = build({ outcome: new Error('timeout') });
    await service.withdraw(dto(), 'admin1');
    await service.markPaid('w1', 'OM-998', 'admin1');
    expect(state.status).toBe(PlatformWithdrawalStatus.PAID);
    expect(state.externalReference).toBe('OM-998');
    await expect(service.markPaid('w1', undefined, 'admin1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('marquer échoué libère le montant et ne peut plus être rejoué', async () => {
    const { service, state } = build({ outcome: new Error('timeout') });
    await service.withdraw(dto(), 'admin1');
    await service.markFailed('w1', 'Virement non passé', 'admin1');
    expect(state.status).toBe(PlatformWithdrawalStatus.FAILED);
    await expect(service.markFailed('w1', 'encore', 'admin1')).rejects.toBeInstanceOf(BadRequestException);
  });
});
