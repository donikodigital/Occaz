// backend/src/common/utils/otp.util.spec.ts
import { generateOtpCode, hashOtpCode, verifyOtpCode } from './otp.util';

describe('otp.util', () => {
  describe('generateOtpCode', () => {
    it('génère toujours un code à exactement 6 chiffres', () => {
      // Répété plusieurs fois — randomInt(0, 1_000_000) peut produire de
      // petites valeurs (ex: 42) qui doivent être complétées par des zéros.
      for (let i = 0; i < 200; i++) {
        const code = generateOtpCode();
        expect(code).toMatch(/^\d{6}$/);
      }
    });
  });

  describe('hashOtpCode', () => {
    it('produit un hash déterministe (même code → même hash)', () => {
      expect(hashOtpCode('123456')).toBe(hashOtpCode('123456'));
    });

    it('produit des hashs différents pour des codes différents', () => {
      expect(hashOtpCode('123456')).not.toBe(hashOtpCode('654321'));
    });

    it('ne renvoie jamais le code en clair dans le hash', () => {
      expect(hashOtpCode('123456')).not.toContain('123456');
    });
  });

  describe('verifyOtpCode', () => {
    it('valide un code face à son propre hash', () => {
      const code = '482913';
      expect(verifyOtpCode(code, hashOtpCode(code))).toBe(true);
    });

    it('rejette un code incorrect', () => {
      const hash = hashOtpCode('482913');
      expect(verifyOtpCode('000000', hash)).toBe(false);
    });

    it('rejette un code correct mais mal formaté (espace, casse) — aucune tolérance de comparaison', () => {
      const code = '482913';
      const hash = hashOtpCode(code);
      expect(verifyOtpCode(` ${code}`, hash)).toBe(false);
    });
  });
});
