// backend/src/common/utils/amount-in-words.spec.ts
import { amountInWords } from './amount-in-words';

describe('amountInWords — montant en lettres (français)', () => {
  const cases: Array<[bigint | number, string]> = [
    [0, 'zéro'],
    [1, 'un'],
    [16, 'seize'],
    [17, 'dix-sept'],
    [21, 'vingt et un'],
    [31, 'trente et un'],
    [42, 'quarante-deux'],
    [70, 'soixante-dix'],
    [71, 'soixante et onze'],
    [77, 'soixante-dix-sept'],
    [80, 'quatre-vingts'],
    [81, 'quatre-vingt-un'],
    [91, 'quatre-vingt-onze'],
    [99, 'quatre-vingt-dix-neuf'],
    [100, 'cent'],
    [101, 'cent un'],
    [180, 'cent quatre-vingts'],
    [200, 'deux cents'],
    [201, 'deux cent un'],
    [999, 'neuf cent quatre-vingt-dix-neuf'],
    [1000, 'mille'],
    [1001, 'mille un'],
    [2000, 'deux mille'],
    [21_000, 'vingt et un mille'],
    [80_000, 'quatre-vingt mille'],
    [200_000, 'deux cent mille'],
    [215_998, 'deux cent quinze mille neuf cent quatre-vingt-dix-huit'],
    [1_000_000, 'un million'],
    [2_500_000, 'deux millions cinq cent mille'],
    [80_000_000, 'quatre-vingts millions'],
    [200_000_000, 'deux cents millions'],
    [1_000_000_000, 'un milliard'],
  ];

  it.each(cases)('%s → %s', (value, expected) => {
    expect(amountInWords(value)).toBe(expected);
  });

  it('accepte un BigInt et un texte', () => {
    expect(amountInWords(7000n)).toBe('sept mille');
    expect(amountInWords('7000')).toBe('sept mille');
  });

  it('refuse un montant négatif ou démesuré', () => {
    expect(() => amountInWords(-1)).toThrow(RangeError);
    expect(() => amountInWords(10n ** 15n)).toThrow(RangeError);
  });
});
