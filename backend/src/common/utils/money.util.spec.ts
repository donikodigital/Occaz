// backend/src/common/utils/money.util.spec.ts
import { formatMoney, sumMoney, toMoneyBigInt } from './money.util';

describe('money.util', () => {
  describe('toMoneyBigInt', () => {
    it('convertit un nombre entier positif', () => {
      expect(toMoneyBigInt(50000)).toBe(50000n);
    });

    it('convertit une chaîne entière positive', () => {
      expect(toMoneyBigInt('50000')).toBe(50000n);
    });

    it('accepte zéro', () => {
      expect(toMoneyBigInt(0)).toBe(0n);
    });

    it('rejette un montant négatif', () => {
      expect(() => toMoneyBigInt(-100)).toThrow();
    });

    it('rejette un montant décimal — les devises gérées (GNF/XOF) n\'ont pas de sous-unité', () => {
      expect(() => toMoneyBigInt('99.99')).toThrow();
      expect(() => toMoneyBigInt(99.99)).toThrow();
    });

    it('rejette une chaîne non numérique', () => {
      expect(() => toMoneyBigInt('abc')).toThrow();
    });

    it('rejette une chaîne vide', () => {
      expect(() => toMoneyBigInt('')).toThrow();
    });
  });

  describe('formatMoney', () => {
    it('formate un BigInt en chaîne, jamais en number (évite toute perte de précision)', () => {
      expect(formatMoney(1_000_000_000_000n)).toBe('1000000000000');
      expect(typeof formatMoney(500n)).toBe('string');
    });
  });

  describe('sumMoney', () => {
    it('additionne plusieurs montants', () => {
      expect(sumMoney([1000n, 2000n, 3000n])).toBe(6000n);
    });

    it('renvoie 0 pour une liste vide', () => {
      expect(sumMoney([])).toBe(0n);
    });

    it('gère un seul montant', () => {
      expect(sumMoney([42n])).toBe(42n);
    });
  });
});
