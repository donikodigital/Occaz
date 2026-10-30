// backend/src/common/guards/user-throttler.guard.spec.ts
// Le quota d'appels se compte par compte utilisateur (jeton vérifié), pas par adresse IP partagée.
import { JwtService } from '@nestjs/jwt';
import { UserThrottlerGuard } from './user-throttler.guard';

const SECRET = 'secret-de-test-assez-long-pour-hs256';
const jwt = new JwtService({});

function guard(secret: string | null = SECRET) {
  const config = { get: jest.fn().mockReturnValue(secret ?? undefined) };
  const instance = new UserThrottlerGuard({ throttlers: [{ ttl: 60_000, limit: 300 }] } as never, {} as never, {} as never, config as never);
  return (req: Record<string, unknown>) => (instance as unknown as { getTracker(r: unknown): Promise<string> }).getTracker(req);
}

const token = (sub: string, secret = SECRET, options: object = {}) => jwt.sign({ sub }, { secret, ...options });

describe('UserThrottlerGuard.getTracker', () => {
  it('jeton valable : suivi par compte, deux comptes derrière la même adresse ont chacun leur quota', async () => {
    const track = guard();
    const a = await track({ headers: { authorization: `Bearer ${token('u1')}` }, ip: '10.0.0.1' });
    const b = await track({ headers: { authorization: `Bearer ${token('u2')}` }, ip: '10.0.0.1' });
    expect(a).toBe('user:u1');
    expect(b).toBe('user:u2');
  });

  it('sans jeton : suivi par adresse IP (limites strictes de connexion / codes inchangées)', async () => {
    const track = guard();
    expect(await track({ headers: {}, ip: '10.0.0.1' })).toBe('10.0.0.1');
    expect(await track({ headers: {}, ips: ['1.2.3.4', '5.6.7.8'], ip: '10.0.0.1' })).toBe('1.2.3.4');
  });

  it('jeton falsifié (mauvaise signature) : retombe sur l\'IP, ne consomme jamais le quota d\'un autre compte', async () => {
    const track = guard();
    const forged = token('victime', 'autre-secret-completement-different-1234');
    expect(await track({ headers: { authorization: `Bearer ${forged}` }, ip: '10.0.0.9' })).toBe('10.0.0.9');
  });

  it('jeton expiré ou illisible : IP', async () => {
    const track = guard();
    const expired = token('u1', SECRET, { expiresIn: -10 });
    expect(await track({ headers: { authorization: `Bearer ${expired}` }, ip: '10.0.0.2' })).toBe('10.0.0.2');
    expect(await track({ headers: { authorization: 'Bearer nimportequoi' }, ip: '10.0.0.3' })).toBe('10.0.0.3');
  });

  it('secret non configuré : IP', async () => {
    const track = guard(null);
    expect(await track({ headers: { authorization: `Bearer ${token('u1')}` }, ip: '10.0.0.4' })).toBe('10.0.0.4');
  });
});
