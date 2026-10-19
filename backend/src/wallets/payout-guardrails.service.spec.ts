// backend/src/wallets/payout-guardrails.service.spec.ts
// Garde-fous d'une demande de retrait : montant strictement positif (jamais 500), minimum, plafond 24 h, numéro valide, nouveau numéro => manuel.
import { BadRequestException } from '@nestjs/common';
import { PayoutStatus } from '@prisma/client';
import { MANUAL_REASON_NEW_DESTINATION, PayoutGuardrailsService, normalizeDestination } from './payout-guardrails.service';

function build(options: { settings?: Record<string, number>; used?: bigint; userPhone?: string; paidBefore?: boolean } = {}) {
  const prisma = {
    platformSetting: { findMany: jest.fn().mockResolvedValue(Object.entries(options.settings ?? {}).map(([key, value]) => ({ key, value }))) },
    payout: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: options.used ?? null } }),
      findFirst: jest.fn().mockResolvedValue(options.paidBefore ? { id: 'p0' } : null),
    },
    driverProfile: { findUnique: jest.fn().mockResolvedValue({ user: { phone: options.userPhone ?? '+224620000001' } }) },
  };
  return { service: new PayoutGuardrailsService(prisma as never), prisma };
}
const ask = (service: PayoutGuardrailsService, rawAmount: string, rawDestination: string | null = '+224620000001') =>
  service.check({ walletId: 'w1', driverId: 'd1', currencyIsoCode: 'GNF', rawAmount, rawDestination });

describe('PayoutGuardrailsService — montant', () => {
  it.each(['0', '00', '-5', '12.5', '1e5', 'abc', '', '9999999999999999999'])('refuse « %s » en 400', async (bad) => {
    await expect(ask(build().service, bad)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepte un montant entier positif', async () => {
    const result = await ask(build().service, '15000');
    expect(result.amount).toBe(15000n);
  });

  it('applique le minimum des réglages', async () => {
    const { service } = build({ settings: { 'payout.min_amount': 5000 } });
    await expect(ask(service, '4999')).rejects.toBeInstanceOf(BadRequestException);
    await expect(ask(service, '5000')).resolves.toBeDefined();
  });

  it('le minimum ne descend jamais sous 1, même mal réglé à 0', async () => {
    const { service } = build({ settings: { 'payout.min_amount': 0 } });
    await expect(ask(service, '0')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('PayoutGuardrailsService — plafond sur 24 h', () => {
  it('0 = aucune limite, sans requête de cumul', async () => {
    const { service, prisma } = build();
    await ask(service, '90000000');
    expect(prisma.payout.aggregate).not.toHaveBeenCalled();
  });

  it('refuse quand le cumul 24 h + la demande dépasse le plafond, et dit combien il reste', async () => {
    const { service } = build({ settings: { 'payout.daily_max_amount': 100_000 }, used: 80_000n });
    await expect(ask(service, '30000')).rejects.toThrow(/Plafond de retrait atteint/);
    await expect(ask(service, '20000')).resolves.toBeDefined();
  });

  it('ne compte ni les retraits refusés ni les annulés', async () => {
    const { service, prisma } = build({ settings: { 'payout.daily_max_amount': 100_000 } });
    await ask(service, '1000');
    expect(prisma.payout.aggregate.mock.calls[0][0].where.status).toEqual({ notIn: [PayoutStatus.FAILED, PayoutStatus.CANCELLED] });
  });
});

describe('PayoutGuardrailsService — numéro de destination', () => {
  it('nettoie espaces, tirets et points', () => {
    expect(normalizeDestination('+224 62-00.00 001')).toBe('+224620000001');
    expect(normalizeDestination('  ')).toBeNull();
    expect(normalizeDestination(undefined)).toBeNull();
  });

  it.each(['abc', '12', '+++224620000001', '224-ABC-123', '1234567890123456'])('refuse « %s »', (bad) => {
    expect(() => normalizeDestination(bad)).toThrow(BadRequestException);
  });

  it('le numéro du compte est connu : envoi automatique possible', async () => {
    const result = await ask(build().service, '1000', '620 00 00 01'.replace(/^/, '+224 '));
    expect(result.manualReason).toBeNull();
  });

  it('un numéro déjà payé avec succès est connu', async () => {
    const result = await ask(build({ paidBefore: true }).service, '1000', '+224655555555');
    expect(result.manualReason).toBeNull();
  });

  it('un NOUVEAU numéro impose la validation manuelle', async () => {
    const result = await ask(build().service, '1000', '+224655555555');
    expect(result.manualReason).toBe(MANUAL_REASON_NEW_DESTINATION);
    expect(result.destinationRef).toBe('+224655555555');
  });

  it('pas de numéro : aucune raison manuelle ici (le service de retrait le traite déjà)', async () => {
    const result = await ask(build().service, '1000', null);
    expect(result).toMatchObject({ destinationRef: null, manualReason: null });
  });
});
