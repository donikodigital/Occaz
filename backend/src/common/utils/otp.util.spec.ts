// backend/src/common/utils/otp.util.spec.ts
import { generateOtpCode, hashOtpCode, maskPhone, verifyOtpCode } from './otp.util';

describe('otp.util', () => {
  const originalPepper = process.env.OTP_HASH_PEPPER;
  beforeEach(() => {
    process.env.OTP_HASH_PEPPER = 'pepper-de-test';
  });
  afterAll(() => {
    if (originalPepper === undefined) delete process.env.OTP_HASH_PEPPER;
    else process.env.OTP_HASH_PEPPER = originalPepper;
  });

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

    it('utilise le secret OTP_HASH_PEPPER : un autre secret donne un autre hash', () => {
      const withFirst = hashOtpCode('123456');
      process.env.OTP_HASH_PEPPER = 'un-autre-secret';
      expect(hashOtpCode('123456')).not.toBe(withFirst);
    });

    it('n\'est plus un simple SHA-256 du code : le hash seul ne permet pas de retrouver le code', () => {
      // SHA-256("123456") — ce que quelqu'un qui lit la base calculerait sans connaître le secret.
      const plainSha256 = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92';
      expect(hashOtpCode('123456')).not.toBe(plainSha256);
      expect(hashOtpCode('123456')).toMatch(/^[0-9a-f]{64}$/);
    });

    it('un code valide avec un secret ne l\'est plus si le secret change', () => {
      const hash = hashOtpCode('482913');
      process.env.OTP_HASH_PEPPER = 'secret-modifie';
      expect(verifyOtpCode('482913', hash)).toBe(false);
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

    it('rejette un hash vide, tronqué ou qui n\'est pas de l\'hexadécimal — sans lever d\'exception', () => {
      expect(verifyOtpCode('482913', '')).toBe(false);
      expect(verifyOtpCode('482913', hashOtpCode('482913').slice(0, 20))).toBe(false);
      expect(verifyOtpCode('482913', 'zzzz')).toBe(false);
    });
  });

  describe('maskPhone', () => {
    it('masque le milieu du numéro pour les journaux', () => {
      expect(maskPhone('+224620000001')).toBe('+224•••0001');
      expect(maskPhone('+224620000001')).not.toContain('62000');
    });

    it('masque entièrement un numéro trop court', () => {
      expect(maskPhone('1234')).toBe('•••');
    });
  });
});
