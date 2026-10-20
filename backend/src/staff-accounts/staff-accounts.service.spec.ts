// backend/src/staff-accounts/staff-accounts.service.spec.ts
// Création des comptes d'équipe : réservée au SuperAdmin, jamais de rôle superadmin, un rôle par pays choisi, lien d'invitation à usage unique.
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { AccountType, OtpPurpose, OtpStatus } from '@prisma/client';
import { hashOtpCode } from '../common/utils/otp.util';
import { StaffAccountsService, buildInvitationBody, normalizePhone } from './staff-accounts.service';

jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('HASHED') }));

const SUPER = { id: 'root', accountType: AccountType.SUPERADMIN, permissions: [] } as never;
const SUPPORT = { id: 'agent', accountType: AccountType.SUPPORT, permissions: ['role.manage'] } as never;

const DTO = {
  firstName: ' Mariama ',
  lastName: 'Diallo',
  email: ' Mariama.Diallo@Occaz.sarl ',
  phone: '+224 620 00 00 01',
  address: 'Kaloum, Conakry',
  roleId: 'role-agent',
};

function createdUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    phone: '+224620000001',
    email: 'mariama.diallo@occaz.sarl',
    accountType: AccountType.SUPPORT,
    passwordHash: null,
    isSuspended: false,
    createdAt: new Date('2026-10-20T10:00:00Z'),
    staffProfile: { firstName: 'Mariama', lastName: 'Diallo', address: 'Kaloum, Conakry' },
    userRoles: [{ role: { key: 'support_agent', name: 'Agent clientèle' }, country: { id: 'c1', name: 'Guinée', isoCode: 'GN' } }],
    ...overrides,
  };
}

function build(options: { role?: { id: string; key: string; name: string } | null; clash?: unknown; countryCount?: number; user?: unknown } = {}) {
  const role = options.role === undefined ? { id: 'role-agent', key: 'support_agent', name: 'Agent clientèle' } : options.role;
  const tx = {
    user: { create: jest.fn().mockResolvedValue({ id: 'u1' }) },
    userRole: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const prisma = {
    role: { findUnique: jest.fn().mockResolvedValue(role) },
    country: { count: jest.fn().mockResolvedValue(options.countryCount ?? 0) },
    user: {
      findFirst: jest.fn().mockResolvedValue(options.clash ?? null),
      findUniqueOrThrow: jest.fn().mockResolvedValue(options.user ?? createdUser()),
      findUnique: jest.fn().mockResolvedValue(options.user ?? createdUser()),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(undefined),
    },
    otpCode: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({ id: 'otp1' }),
      delete: jest.fn().mockResolvedValue(undefined),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const email = { send: jest.fn().mockResolvedValue(undefined) };
  return { service: new StaffAccountsService(prisma as never, audit as never, email as never), prisma, tx, audit, email };
}

describe('StaffAccountsService.create', () => {
  const previousUrl = process.env.ADMIN_PANEL_URL;
  const previousPepper = process.env.OTP_HASH_PEPPER;
  beforeEach(() => {
    process.env.ADMIN_PANEL_URL = 'https://admin.occaz.sarl/';
    process.env.OTP_HASH_PEPPER = 'pepper-de-test';
  });
  afterEach(() => {
    if (previousUrl === undefined) delete process.env.ADMIN_PANEL_URL;
    else process.env.ADMIN_PANEL_URL = previousUrl;
    if (previousPepper === undefined) delete process.env.OTP_HASH_PEPPER;
    else process.env.OTP_HASH_PEPPER = previousPepper;
  });

  it('refuse tout compte qui n\'est pas SuperAdmin, même avec la permission role.manage : rien n\'est créé', async () => {
    const { service, prisma } = build();
    await expect(service.create(DTO, SUPPORT)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.list(SUPPORT)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.resendInvitation('u1', SUPPORT)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuse le rôle superadmin', async () => {
    const { service, prisma } = build({ role: { id: 'role-agent', key: 'superadmin', name: 'Super administrateur' } });
    await expect(service.create(DTO, SUPER)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rôle inconnu : 404', async () => {
    const { service } = build({ role: null });
    await expect(service.create(DTO, SUPER)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sans ADMIN_PANEL_URL : refus avant toute écriture (un e-mail sans lien ne servirait à rien)', async () => {
    delete process.env.ADMIN_PANEL_URL;
    const { service, prisma } = build();
    await expect(service.create(DTO, SUPER)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.role.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('adresse e-mail ou numéro déjà utilisés : 409, rien n\'est créé', async () => {
    const byEmail = build({ clash: { email: 'mariama.diallo@occaz.sarl', phone: '+224699999999' } });
    await expect(byEmail.service.create(DTO, SUPER)).rejects.toThrow('adresse e-mail');
    const byPhone = build({ clash: { email: 'autre@occaz.sarl', phone: '+224620000001' } });
    await expect(byPhone.service.create(DTO, SUPER)).rejects.toBeInstanceOf(ConflictException);
    await expect(byPhone.service.create(DTO, SUPER)).rejects.toThrow('numéro');
    expect(byEmail.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('pays introuvable : 404', async () => {
    const { service } = build({ countryCount: 1 });
    await expect(service.create({ ...DTO, countryIds: ['c1', 'c2'] }, SUPER)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('plusieurs pays : un rôle par pays, compte Support sans mot de passe, e-mail normalisé, invitation envoyée avec le lien', async () => {
    const { service, tx, email, prisma, audit } = build({ countryCount: 2 });
    const result = await service.create({ ...DTO, countryIds: ['c1', 'c2', 'c1'] }, SUPER);

    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'mariama.diallo@occaz.sarl',
          phone: '+224620000001',
          accountType: AccountType.SUPPORT,
          isPhoneVerified: true,
          staffProfile: { create: { firstName: 'Mariama', lastName: 'Diallo', address: 'Kaloum, Conakry' } },
        }),
      }),
    );
    expect(tx.user.create.mock.calls[0][0].data).not.toHaveProperty('passwordHash');
    expect(tx.userRole.createMany).toHaveBeenCalledWith({
      data: [
        { userId: 'u1', roleId: 'role-agent', countryId: 'c1' },
        { userId: 'u1', roleId: 'role-agent', countryId: 'c2' },
      ],
    });

    // Le jeton part dans le lien, et seul son hash est conservé.
    expect(email.send).toHaveBeenCalledTimes(1);
    const [to, subject, body, action] = email.send.mock.calls[0];
    expect(to).toBe('mariama.diallo@occaz.sarl');
    expect(subject).toContain('Bienvenue');
    expect(action.url).toMatch(/^https:\/\/admin\.occaz\.sarl\/definir-mot-de-passe\?token=[A-Za-z0-9_-]{43}$/);
    expect(body).toContain('https://admin.occaz.sarl');
    expect(body).toContain('mariama.diallo@occaz.sarl');
    expect(body).toContain('+224620000001');
    expect(body).toContain(action.url);
    const token = new URL(action.url).searchParams.get('token')!;
    const stored = prisma.otpCode.create.mock.calls[0][0].data;
    expect(stored.purpose).toBe(OtpPurpose.STAFF_INVITATION);
    expect(stored.code).toBe(hashOtpCode(token));
    expect(JSON.stringify(stored)).not.toContain(token);
    expect(stored.expiresAt.getTime() - Date.now()).toBeGreaterThan(6.9 * 86_400_000);

    expect(result.invitationSent).toBe(true);
    expect(result.account).toMatchObject({ id: 'u1', status: 'INVITED', firstName: 'Mariama' });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'STAFF_ACCOUNT_CREATE', actorId: 'root', entityId: 'u1' }));
    expect(JSON.stringify(audit.log.mock.calls[0][0])).not.toContain(token);
  });

  it('aucun pays choisi : une seule attribution sans pays (tous les pays)', async () => {
    const { service, tx } = build();
    await service.create(DTO, SUPER);
    expect(tx.userRole.createMany).toHaveBeenCalledWith({ data: [{ userId: 'u1', roleId: 'role-agent', countryId: null }] });
  });

  it('e-mail non parti : le compte existe, invitationSent=false et le jeton inutile est supprimé', async () => {
    const { service, email, prisma } = build();
    email.send.mockRejectedValue(new Error('RESEND_API_KEY manquante'));
    const result = await service.create(DTO, SUPER);
    expect(result.invitationSent).toBe(false);
    expect(prisma.otpCode.delete).toHaveBeenCalledWith({ where: { id: 'otp1' } });
  });
});

describe('StaffAccountsService — lien d\'invitation', () => {
  const previousPepper = process.env.OTP_HASH_PEPPER;
  beforeEach(() => {
    process.env.OTP_HASH_PEPPER = 'pepper-de-test';
    process.env.ADMIN_PANEL_URL = 'https://admin.occaz.sarl';
  });
  afterEach(() => {
    if (previousPepper === undefined) delete process.env.OTP_HASH_PEPPER;
    else process.env.OTP_HASH_PEPPER = previousPepper;
    delete process.env.ADMIN_PANEL_URL;
  });
  const TOKEN = 'a'.repeat(43);

  it('lien inconnu, expiré ou déjà utilisé : même erreur 400, aucun mot de passe écrit', async () => {
    const { service, prisma } = build();
    prisma.otpCode.findFirst.mockResolvedValue(null);
    await expect(service.inspectInvitation(TOKEN)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.acceptInvitation(TOKEN, 'MotDePasse123')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('cherche le jeton par son hash, parmi les invitations en attente non expirées', async () => {
    const { service, prisma } = build();
    prisma.otpCode.findFirst.mockResolvedValue({ id: 'otp1', userId: 'u1' });
    await service.inspectInvitation(TOKEN);
    expect(prisma.otpCode.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ purpose: OtpPurpose.STAFF_INVITATION, status: OtpStatus.PENDING, code: hashOtpCode(TOKEN) }),
      }),
    );
  });

  it('bon lien : mot de passe haché enregistré, e-mail vérifié, lien consommé', async () => {
    const { service, prisma, audit } = build();
    prisma.otpCode.findFirst.mockResolvedValue({ id: 'otp1', userId: 'u1' });
    await expect(service.inspectInvitation(TOKEN)).resolves.toEqual({ firstName: 'Mariama', email: 'mariama.diallo@occaz.sarl' });

    await service.acceptInvitation(TOKEN, 'MotDePasse123');
    expect(prisma.otpCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'otp1', status: OtpStatus.PENDING }), data: expect.objectContaining({ status: OtpStatus.VERIFIED }) }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { passwordHash: 'HASHED', isEmailVerified: true, failedLoginAttempts: 0, lockedUntil: null },
    });
    expect(JSON.stringify(audit.log.mock.calls)).not.toContain('MotDePasse123');
  });

  it('deux requêtes simultanées avec le même lien : la seconde est refusée', async () => {
    const { service, prisma } = build();
    prisma.otpCode.findFirst.mockResolvedValue({ id: 'otp1', userId: 'u1' });
    prisma.otpCode.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.acceptInvitation(TOKEN, 'MotDePasse123')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('compte suspendu ou non Support : lien refusé', async () => {
    const suspended = build({ user: createdUser({ isSuspended: true }) });
    suspended.prisma.otpCode.findFirst.mockResolvedValue({ id: 'otp1', userId: 'u1' });
    await expect(suspended.service.inspectInvitation(TOKEN)).rejects.toBeInstanceOf(BadRequestException);
    const customer = build({ user: createdUser({ accountType: AccountType.CUSTOMER }) });
    customer.prisma.otpCode.findFirst.mockResolvedValue({ id: 'otp1', userId: 'u1' });
    await expect(customer.service.acceptInvitation(TOKEN, 'MotDePasse123')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('renvoyer l\'invitation d\'un compte déjà activé : refusé', async () => {
    const { service, email } = build({ user: createdUser({ passwordHash: 'x' }) });
    await expect(service.resendInvitation('u1', SUPER)).rejects.toBeInstanceOf(BadRequestException);
    expect(email.send).not.toHaveBeenCalled();
  });

  it('renvoyer l\'invitation : remplace l\'ancienne et réexpédie ; erreur 503 si l\'e-mail ne part pas', async () => {
    const ok = build();
    await expect(ok.service.resendInvitation('u1', SUPER)).resolves.toEqual({ invitationSent: true });
    expect(ok.prisma.otpCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ purpose: OtpPurpose.STAFF_INVITATION, status: OtpStatus.PENDING }), data: { status: OtpStatus.EXPIRED } }),
    );
    expect(ok.email.send).toHaveBeenCalledTimes(1);

    const ko = build();
    ko.email.send.mockRejectedValue(new Error('panne'));
    await expect(ko.service.resendInvitation('u1', SUPER)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('StaffAccountsService.list', () => {
  it('statut : activé (mot de passe choisi), invité (lien valable) ou invitation expirée', async () => {
    const { service, prisma } = build();
    prisma.user.findMany.mockResolvedValue([
      createdUser({ id: 'a', passwordHash: 'h' }),
      createdUser({ id: 'b' }),
      createdUser({ id: 'c' }),
    ]);
    prisma.otpCode.findMany.mockResolvedValue([{ userId: 'b' }]);
    const rows = await service.list(SUPER);
    expect(rows.map((row) => [row.id, row.status])).toEqual([
      ['a', 'ACTIVE'],
      ['b', 'INVITED'],
      ['c', 'INVITATION_EXPIRED'],
    ]);
    expect(JSON.stringify(rows)).not.toContain('passwordHash');
  });

  it('rôle sans pays = tous les pays ; rôle limité = liste des pays', async () => {
    const { service, prisma } = build();
    prisma.user.findMany.mockResolvedValue([
      createdUser({
        userRoles: [
          { role: { key: 'support_agent', name: 'Agent' }, country: null },
          { role: { key: 'finance_manager', name: 'Finance' }, country: { id: 'c1', name: 'Guinée', isoCode: 'GN' } },
          { role: { key: 'finance_manager', name: 'Finance' }, country: { id: 'c2', name: 'Sénégal', isoCode: 'SN' } },
        ],
      }),
    ]);
    const [row] = await service.list(SUPER);
    expect(row.roles).toEqual([
      { key: 'support_agent', name: 'Agent', allCountries: true, countries: [] },
      { key: 'finance_manager', name: 'Finance', allCountries: false, countries: [{ id: 'c1', name: 'Guinée', isoCode: 'GN' }, { id: 'c2', name: 'Sénégal', isoCode: 'SN' }] },
    ]);
  });
});

describe('utilitaires', () => {
  it('normalizePhone retire espaces, tirets, points et parenthèses', () => {
    expect(normalizePhone('+224 (620) 00-00.01')).toBe('+224620000001');
  });

  it('le corps de l\'e-mail contient le site, l\'identifiant, le téléphone et le lien', () => {
    const body = buildInvitationBody({
      firstName: 'Mariama',
      email: 'm@occaz.sarl',
      phone: '+224620000001',
      siteUrl: 'https://admin.occaz.sarl',
      setPasswordUrl: 'https://admin.occaz.sarl/definir-mot-de-passe?token=abc',
      roles: [{ key: 'support_agent', name: 'Agent clientèle', allCountries: false, countries: [{ id: 'c1', name: 'Guinée', isoCode: 'GN' }] }],
    });
    expect(body).toContain('Bonjour Mariama,');
    expect(body).toContain('Agent clientèle (Guinée)');
    expect(body).toContain('Site : https://admin.occaz.sarl');
    expect(body).toContain('Identifiant de connexion : m@occaz.sarl');
    expect(body).toContain('Téléphone enregistré : +224620000001');
    expect(body).toContain('definir-mot-de-passe?token=abc');
  });
});
