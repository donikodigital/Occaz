// backend/src/notifications/notifications.service.staff-email.spec.ts
// Alertes équipe par email : en plus de la cloche, pour les événements qui ne peuvent pas attendre (retrait à valider).
import { NotificationType } from '@prisma/client';
import { NotificationsService } from './notifications.service';

function build(staff: Array<{ id: string; email: string | null }>) {
  const prisma = {
    notification: { createMany: jest.fn().mockResolvedValue({ count: staff.length }) },
    user: { findMany: jest.fn().mockResolvedValue(staff) },
  };
  const emailProvider = { send: jest.fn().mockResolvedValue(undefined) };
  const service = new NotificationsService(prisma as never, {} as never, {} as never, {} as never, emailProvider as never, {} as never);
  return { service, prisma, emailProvider };
}

const alert = {
  permission: 'payout.manage',
  type: NotificationType.DRIVER_PAYMENT,
  title: 'Retrait à valider',
  body: 'Un conducteur demande un retrait de 15 000 XOF.',
  link: '/payouts',
};

describe('NotificationsService.notifyStaff — email', () => {
  const previousUrl = process.env.ADMIN_PANEL_URL;
  afterEach(() => {
    if (previousUrl === undefined) delete process.env.ADMIN_PANEL_URL;
    else process.env.ADMIN_PANEL_URL = previousUrl;
  });

  it('sans l\'option email : cloche seulement, aucun email', async () => {
    const { service, emailProvider } = build([{ id: 'a1', email: 'admin@occaz.sarl' }]);
    await service.notifyStaff(alert);
    expect(emailProvider.send).not.toHaveBeenCalled();
  });

  it('avec l\'option email : un email par membre de l\'équipe, après l\'enregistrement de la cloche', async () => {
    const { service, prisma, emailProvider } = build([
      { id: 'a1', email: 'admin@occaz.sarl' },
      { id: 'f1', email: 'finance@occaz.sarl' },
    ]);
    delete process.env.ADMIN_PANEL_URL;
    await service.notifyStaff({ ...alert, email: true });
    expect(prisma.notification.createMany).toHaveBeenCalledTimes(1);
    expect(emailProvider.send).toHaveBeenCalledTimes(2);
    expect(emailProvider.send).toHaveBeenCalledWith('admin@occaz.sarl', 'Retrait à valider', alert.body, undefined);
    expect(emailProvider.send).toHaveBeenCalledWith('finance@occaz.sarl', 'Retrait à valider', alert.body, undefined);
  });

  it('ADMIN_PANEL_URL défini : l\'email porte le bouton vers la page (« / » final ignoré)', async () => {
    const { service, emailProvider } = build([{ id: 'a1', email: 'admin@occaz.sarl' }]);
    process.env.ADMIN_PANEL_URL = 'https://admin.occaz.sarl/';
    await service.notifyStaff({ ...alert, email: true });
    expect(emailProvider.send).toHaveBeenCalledWith('admin@occaz.sarl', 'Retrait à valider', alert.body, {
      url: 'https://admin.occaz.sarl/payouts',
      label: 'Ouvrir dans le back-office',
    });
  });

  it('un compte sans adresse email est ignoré, les autres reçoivent leur email', async () => {
    const { service, emailProvider } = build([
      { id: 'a1', email: null },
      { id: 'f1', email: 'finance@occaz.sarl' },
    ]);
    await service.notifyStaff({ ...alert, email: true });
    expect(emailProvider.send).toHaveBeenCalledTimes(1);
    expect(emailProvider.send.mock.calls[0][0]).toBe('finance@occaz.sarl');
  });

  it('un email qui échoue n\'empêche pas les autres et ne lève jamais d\'exception', async () => {
    const { service, emailProvider } = build([
      { id: 'a1', email: 'admin@occaz.sarl' },
      { id: 'f1', email: 'finance@occaz.sarl' },
    ]);
    emailProvider.send.mockRejectedValueOnce(new Error('Resend a répondu 500'));
    await expect(service.notifyStaff({ ...alert, email: true })).resolves.toBeUndefined();
    expect(emailProvider.send).toHaveBeenCalledTimes(2);
  });

  it('personne à alerter : ni cloche ni email', async () => {
    const { service, prisma, emailProvider } = build([]);
    await service.notifyStaff({ ...alert, email: true });
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
    expect(emailProvider.send).not.toHaveBeenCalled();
  });
});
