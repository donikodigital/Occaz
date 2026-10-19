// backend/src/common/utils/money.util.spec.ts
// Une saisie de montant invalide doit donner une erreur 400 (jamais une erreur 500), et zéro est refusé là où un montant doit être > 0.
import { BadRequestException } from '@nestjs/common';
import { toMoneyBigInt, toPositiveMoneyBigInt } from './money.util';

describe('toMoneyBigInt', () => {
  it('accepte un entier positif ou nul', () => {
    expect(toMoneyBigInt('15000')).toBe(15000n);
    expect(toMoneyBigInt(0)).toBe(0n);
  });
  it.each(['-1', '1.5', '1e3', ' 12', 'abc', '', '9999999999999999'])('« %s » => BadRequestException (400)', (bad) => {
    expect(() => toMoneyBigInt(bad)).toThrow(BadRequestException);
  });
});

describe('toPositiveMoneyBigInt', () => {
  it('refuse zéro', () => {
    expect(() => toPositiveMoneyBigInt('0')).toThrow(BadRequestException);
    expect(() => toPositiveMoneyBigInt('000')).toThrow(BadRequestException);
    expect(toPositiveMoneyBigInt('1')).toBe(1n);
  });
});
