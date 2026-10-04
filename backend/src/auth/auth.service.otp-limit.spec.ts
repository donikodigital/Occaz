// backend/src/auth/auth.service.otp-limit.spec.ts
// Limite des demandes de code SMS par numéro.
import { HttpException, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';

function build(recentRequests: number) {
  const prisma = { otpCode: { count: jest.fn().mockResolvedValue(recentRequests) } };
  const service = new AuthService(prisma as never, ...(Array(9).fill({}) as [never, never, never, never, never, never, never, never, never]));
  return { service, prisma };
}
const assertAllowed = (service: AuthService, userId: string) =>
  (service as unknown as { assertOtpRequestAllowed(id: string): Promise<void> }).assertOtpRequestAllowed(userId);

describe('AuthService — limite de demandes de code', () => {
  it('laisse passer sous la limite', async () => {
    const { service } = build(4);
    await expect(assertAllowed(service, 'u1')).resolves.toBeUndefined();
  });

  it('refuse à partir de 5 demandes dans la fenêtre (429)', async () => {
    const { service } = build(5);
    await expect(assertAllowed(service, 'u1')).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
    await expect(assertAllowed(service, 'u1')).rejects.toBeInstanceOf(HttpException);
  });

  it('ne compte que les codes de connexion récents de ce numéro', async () => {
    const { service, prisma } = build(0);
    await assertAllowed(service, 'u1');
    const where = prisma.otpCode.count.mock.calls[0][0].where;
    expect(where.userId).toBe('u1');
    expect(where.createdAt.gte).toBeInstanceOf(Date);
  });
});
