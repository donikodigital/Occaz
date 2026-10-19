// backend/src/account-roles/account-roles.service.spec.ts
// Compte à deux profils : un conducteur ouvre son espace passager avec son PIN, sans nouveau numéro ; garde-fous de sécurité.
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AccountType, DriverAccountStatus } from '@prisma/client';
import { AccountRolesService } from './account-roles.service';

const driverProfile = (over: Record<string, unknown> = {}) => ({
  id: 'dp1', firstName: 'Mamadou', lastName: 'Diallo', photoUrl: 'p.jpg', countryId: 'c1', cityId: 'v1', dateOfBirth: new Date('1990-01-01'),
  status: DriverAccountStatus.PENDING, deletedAt: null, ...over,
});

function build(user: Record<string, unknown> | null) {
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(user) },
    customerProfile: { create: jest.fn().mockResolvedValue({ id: 'cp1' }) },
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const pin = { assertPin: jest.fn().mockResolvedValue(undefined) };
  return { service: new AccountRolesService(prisma as never, audit as never, pin as never), prisma, audit, pin };
}

const driverUser = (over: Record<string, unknown> = {}) => ({
  accountType: AccountType.DRIVER, isSuspended: false, isActive: true, driverProfile: driverProfile(), customerProfile: null, ...over,
});

describe('AccountRolesService.activateCustomer', () => {
  it('crée le profil client à partir du profil conducteur, après vérification du PIN', async () => {
    const { service, prisma, pin, audit } = build(driverUser());
    await service.activateCustomer('u1', '482913');
    expect(pin.assertPin).toHaveBeenCalledWith('u1', '482913', 'ACTIVATE_CUSTOMER_PROFILE');
    expect(prisma.customerProfile.create.mock.calls[0][0].data).toMatchObject({
      userId: 'u1', firstName: 'Mamadou', lastName: 'Diallo', photoUrl: 'p.jpg', countryId: 'c1', cityId: 'v1',
    });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'CUSTOMER_PROFILE_ACTIVATED' }));
  });

  it('un conducteur dont le dossier est en attente peut basculer en mode passager', async () => {
    const { service } = build(driverUser({ driverProfile: driverProfile({ status: DriverAccountStatus.IN_VERIFICATION }) }));
    await expect(service.activateCustomer('u1', '482913')).resolves.toBeDefined();
  });

  it('PIN incorrect : rien n\'est créé', async () => {
    const { service, prisma, pin } = build(driverUser());
    pin.assertPin.mockRejectedValue(new ForbiddenException('Code PIN incorrect.'));
    await expect(service.activateCustomer('u1', '000001')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.customerProfile.create).not.toHaveBeenCalled();
  });

  it('refuse un compte suspendu, un profil conducteur suspendu, un espace déjà ouvert, et l\'équipe du back-office', async () => {
    await expect(build(driverUser({ isSuspended: true })).service.activateCustomer('u1', '482913')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(build(driverUser({ driverProfile: driverProfile({ status: DriverAccountStatus.SUSPENDED }) })).service.activateCustomer('u1', '482913')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(build(driverUser({ customerProfile: { id: 'cp0' } })).service.activateCustomer('u1', '482913')).rejects.toBeInstanceOf(ConflictException);
    await expect(build(driverUser({ accountType: AccountType.SUPPORT })).service.activateCustomer('u1', '482913')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('sans profil conducteur : renvoie vers l\'inscription', async () => {
    await expect(build(driverUser({ driverProfile: null })).service.activateCustomer('u1', '482913')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('compte introuvable : 404', async () => {
    await expect(build(null).service.activateCustomer('u1', '482913')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('AccountRolesService.rolesOf', () => {
  it('liste les profils du compte (un profil supprimé ne compte pas)', async () => {
    const { service } = build({
      accountType: AccountType.DRIVER,
      customerProfile: { id: 'cp1', deletedAt: null },
      driverProfile: { id: 'dp1', deletedAt: new Date() },
    });
    await expect(service.rolesOf('u1')).resolves.toEqual({ primary: AccountType.DRIVER, customer: true, driver: false });
  });
});
