// backend/src/common/utils/platform-earnings.spec.ts
import { AccountType } from '@prisma/client';
import { canSeePlatformEarnings, withoutDisputeFinance, withoutPlatformFee, withoutWallet } from './platform-earnings';

const user = (accountType: AccountType, permissions: string[]) => ({ accountType, permissions });

describe('canSeePlatformEarnings', () => {
  it('le SuperAdmin voit tout', () => {
    expect(canSeePlatformEarnings(user(AccountType.SUPERADMIN, []))).toBe(true);
  });

  it('un agent du service client ne voit pas les gains de la plateforme', () => {
    const support = ['user.read', 'trip.read', 'shipment.read', 'dispute.read', 'dispute.resolve', 'user.suspend', 'user_report.manage'];
    expect(canSeePlatformEarnings(user(AccountType.SUPPORT, support))).toBe(false);
  });

  it.each(['dashboard.admin_read', 'platform_wallet.read', 'commission.manage', 'payout.manage'])('%s ouvre la vue financière', (permission) => {
    expect(canSeePlatformEarnings(user(AccountType.SUPPORT, [permission]))).toBe(true);
  });
});

describe('masquage des montants', () => {
  it('retire la commission sans toucher l’original', () => {
    const shipment = { id: 's1', totalAmount: 150000n, platformFee: 15000n };
    expect(withoutPlatformFee(shipment)).toEqual({ id: 's1', totalAmount: 150000n });
    expect(shipment.platformFee).toBe(15000n);
  });

  it('retire le portefeuille d’un conducteur', () => {
    expect(withoutWallet({ id: 'd1', wallet: { balance: 5n } })).toEqual({ id: 'd1' });
  });

  it('retire la commission de la réservation et de l’envoi d’un litige', () => {
    const dispute = { id: 'x', booking: { id: 'b', platformFee: 1n }, shipment: { id: 's', platformFee: 2n } };
    expect(withoutDisputeFinance(dispute)).toEqual({ id: 'x', booking: { id: 'b' }, shipment: { id: 's' } });
  });

  it('laisse intact ce qui n’est pas un objet', () => {
    expect(withoutPlatformFee(null)).toBeNull();
    expect(withoutDisputeFinance({ id: 'x', booking: null })).toEqual({ id: 'x', booking: null });
  });
});
