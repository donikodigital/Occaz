// backend/src/wallets/pin-confirmation.service.spec.ts
// Confirmation d'un retrait par le PIN de connexion : bon PIN => rien ; mauvais PIN => erreur + compteur partagé avec la connexion ;
// 5 erreurs => verrouillage 15 min ; compte verrouillé => refus sans même regarder le PIN.
import { ForbiddenException, HttpStatus } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { pinDigest } from '../common/utils/pin.util';
import { PinConfirmationService } from './pin-confirmation.service';

function build(user: Partial<{ phone: string; passwordHash: string | null; failedLoginAttempts: number; lockedUntil: Date | null }> = {}) {
  const state = { phone: '+224620000001', passwordHash: bcrypt.hashSync(pinDigest('482913'), 4) as string | null, failedLoginAttempts: 0, lockedUntil: null as Date | null, ...user };
  const prisma = {
    user: {
      findUnique: jest.fn().mockImplementation(() => Promise.resolve({ id: 'u1', ...state })),
      update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        if (data.failedLoginAttempts && typeof data.failedLoginAttempts === 'object') state.failedLoginAttempts += 1;
        else Object.assign(state, data);
        return Promise.resolve({ failedLoginAttempts: state.failedLoginAttempts });
      }),
    },
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  return { service: new PinConfirmationService(prisma as never, audit as never), prisma, audit, state };
}

describe('PinConfirmationService.assertPin', () => {
  afterEach(() => {
    delete process.env.AUTH_TEST_MODE_ENABLED;
    delete process.env.AUTH_TEST_PHONE_NUMBERS;
  });

  it('bon PIN : passe, et remet à zéro les erreurs précédentes', async () => {
    const { service, prisma } = build({ failedLoginAttempts: 3 });
    await expect(service.assertPin('u1', '482913', 'PAYOUT_REQUEST')).resolves.toBeUndefined();
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { failedLoginAttempts: 0, lockedUntil: null } });
  });

  it('mauvais PIN : 403, une erreur de plus au compteur de la connexion, tracé', async () => {
    const { service, state, audit } = build();
    await expect(service.assertPin('u1', '111222', 'PAYOUT_REQUEST')).rejects.toBeInstanceOf(ForbiddenException);
    expect(state.failedLoginAttempts).toBe(1);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'PIN_CONFIRMATION_FAILED' }));
  });

  it('format invalide (lettres, 5 chiffres) : refusé comme un mauvais PIN', async () => {
    const { service } = build();
    await expect(service.assertPin('u1', 'abcdef', 'x')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.assertPin('u1', '48291', 'x')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('5e erreur de suite : compte verrouillé 15 minutes (429)', async () => {
    const { service, state } = build({ failedLoginAttempts: 4 });
    await expect(service.assertPin('u1', '111222', 'x')).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
    expect(state.lockedUntil).toBeInstanceOf(Date);
    expect((state.lockedUntil as Date).getTime()).toBeGreaterThan(Date.now() + 14 * 60_000);
  });

  it('compte déjà verrouillé : 429 même avec le bon PIN', async () => {
    const { service } = build({ lockedUntil: new Date(Date.now() + 5 * 60_000) });
    await expect(service.assertPin('u1', '482913', 'x')).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
  });

  it('compte sans PIN défini : 403 explicite', async () => {
    const { service } = build({ passwordHash: null });
    await expect(service.assertPin('u1', '482913', 'x')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('numéro de test en mode test : 000000 passe, même sans PIN défini', async () => {
    process.env.AUTH_TEST_MODE_ENABLED = 'true';
    process.env.AUTH_TEST_PHONE_NUMBERS = '+224620000001';
    const { service } = build({ passwordHash: null });
    await expect(service.assertPin('u1', '000000', 'x')).resolves.toBeUndefined();
  });

  it('000000 ne passe PAS hors mode test', async () => {
    const { service } = build();
    await expect(service.assertPin('u1', '000000', 'x')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
