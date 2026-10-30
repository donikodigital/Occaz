// backend/src/auth/strategies/jwt.strategy.language.spec.ts
// La langue du compte accompagne l'utilisateur authentifié (elle sert quand l'application n'envoie pas l'en-tête).
import { JwtStrategy } from './jwt.strategy';

function build(language: unknown) {
  const config = { get: () => 'secret' };
  const users = { findById: jest.fn().mockResolvedValue({ id: 'u1', phone: '+224620000000', accountType: 'CUSTOMER', isActive: true, isSuspended: false, language }) };
  const sessions = { validateAndGet: jest.fn().mockResolvedValue({ userId: 'u1' }) };
  const roles = { getEffectivePermissions: jest.fn().mockResolvedValue({ permissions: [], scopedCountryIds: [], countryScopes: [] }) };
  return new JwtStrategy(config as never, users as never, sessions as never, roles as never);
}

describe('JwtStrategy — langue', () => {
  it.each([
    ['en-GB', 'en-GB'],
    ['pt-PT', 'pt-PT'],
    ['fr', 'fr'],
    [undefined, 'fr'],
    ['zz', 'fr'],
  ])('compte « %s » → utilisateur « %s »', async (stored, expected) => {
    const user = await build(stored).validate({ sub: 'u1', sessionId: 's1' } as never);
    expect(user.language).toBe(expected);
  });
});
