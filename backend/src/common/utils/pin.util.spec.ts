// backend/src/common/utils/pin.util.spec.ts
import { isPinFormat, pinDigest, pinWeakness } from './pin.util';
import { maskEmail } from './mask.util';
import { TEST_CODE, isTestPhone } from './test-mode.util';

describe('pin.util', () => {
  it('le format : exactement 6 chiffres', () => {
    expect(isPinFormat('482913')).toBe(true);
    for (const bad of ['12345', '1234567', '12345a', '12 456', '', undefined, 482913]) expect(isPinFormat(bad)).toBe(false);
  });

  it('refuse les codes les plus devinables', () => {
    for (const weak of ['000000', '111111', '123456', '654321', '234567', '121212', '123123', '987654']) {
      expect(pinWeakness(weak)).not.toBeNull();
    }
  });

  it('accepte un code ordinaire', () => {
    for (const fine of ['482913', '705318', '190274', '112358']) expect(pinWeakness(fine)).toBeNull();
  });

  it('l’empreinte dépend du secret serveur et du code', () => {
    process.env.OTP_HASH_PEPPER = 'pepper-a';
    const a = pinDigest('482913');
    process.env.OTP_HASH_PEPPER = 'pepper-b';
    expect(pinDigest('482913')).not.toBe(a);
    expect(pinDigest('482914')).not.toBe(pinDigest('482913'));
    expect(pinDigest('482913')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('maskEmail', () => {
  it('montre le domaine et cache le reste', () => {
    expect(maskEmail('thierno@gmail.com')).toBe('t•••o@gmail.com');
    expect(maskEmail('ab@x.org')).toBe('a•••@x.org');
    expect(maskEmail('pasunemail')).toBe('•••');
  });
});

describe('isTestPhone', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('faux tant que le mode test est coupé, même pour un numéro listé', () => {
    process.env.AUTH_TEST_PHONE_NUMBERS = '+224600000001';
    delete process.env.AUTH_TEST_MODE_ENABLED;
    expect(isTestPhone('+224600000001')).toBe(false);
  });

  it('vrai uniquement pour les numéros listés quand le mode test est actif', () => {
    process.env.AUTH_TEST_MODE_ENABLED = 'true';
    process.env.AUTH_TEST_PHONE_NUMBERS = '+224600000001, +224600000003';
    expect(isTestPhone('+224600000003')).toBe(true);
    expect(isTestPhone('+224620000000')).toBe(false);
    expect(isTestPhone(undefined)).toBe(false);
    expect(TEST_CODE).toBe('000000');
  });
});
