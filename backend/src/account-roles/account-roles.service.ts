// backend/src/account-roles/account-roles.service.ts
// [19/10/2026] v1 — Un seul compte (un numéro, un code PIN), deux profils possibles : client ET conducteur.
//
// Pourquoi pas deux comptes : le numéro est unique et c'est lui qui prouve l'identité (SMS d'inscription, changement de numéro). Deux comptes
// sur un même numéro doubleraient les codes PIN à protéger et permettraient à un conducteur suspendu de se recréer un compte client.
// Ici, la suspension du compte vaut pour les deux profils (User.isSuspended), et un seul PIN protège tout.
//
// Les droits viennent des PROFILS (un profil client ouvre l'espace passager, un profil conducteur ouvre l'espace conducteur) ; les gains et
// retraits restent dans le portefeuille du profil conducteur, séparé de tout paiement fait en tant que client.
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountType, DriverAccountStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PinConfirmationService } from '../wallets/pin-confirmation.service';

export interface AccountRoles {
  /** Type choisi à l'inscription. */
  primary: AccountType;
  customer: boolean;
  driver: boolean;
}

@Injectable()
export class AccountRolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly pin: PinConfirmationService,
  ) {}

  async rolesOf(userId: string): Promise<AccountRoles> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        accountType: true,
        customerProfile: { select: { id: true, deletedAt: true } },
        driverProfile: { select: { id: true, deletedAt: true } },
      },
    });
    if (!user) throw new NotFoundException('Compte introuvable.');
    return {
      primary: user.accountType,
      customer: Boolean(user.customerProfile && !user.customerProfile.deletedAt),
      driver: Boolean(user.driverProfile && !user.driverProfile.deletedAt),
    };
  }

  /**
   * Un conducteur ouvre son espace passager. Les informations (nom, photo, pays, ville) viennent de son profil conducteur : pas de
   * nouveau SMS, pas de nouveau numéro. Le code PIN est demandé : c'est l'identité complète qui s'élargit.
   */
  async activateCustomer(userId: string, pin: string): Promise<AccountRoles> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { accountType: true, isSuspended: true, isActive: true, driverProfile: true, customerProfile: { select: { id: true } } },
    });
    if (!user) throw new NotFoundException('Compte introuvable.');
    if (user.accountType !== AccountType.DRIVER && user.accountType !== AccountType.CUSTOMER) {
      throw new ForbiddenException("Ce type de compte ne peut pas avoir d'espace passager.");
    }
    if (user.isSuspended || !user.isActive) throw new ForbiddenException('Ce compte est suspendu.');
    if (user.customerProfile) throw new ConflictException('Votre espace passager est déjà ouvert.');
    const driver = user.driverProfile;
    if (!driver || driver.deletedAt) {
      throw new BadRequestException("Vous n'avez pas de profil conducteur : créez votre profil passager depuis l'inscription.");
    }
    if (driver.status === DriverAccountStatus.SUSPENDED || driver.status === DriverAccountStatus.BLOCKED || driver.status === DriverAccountStatus.DEACTIVATED) {
      throw new ForbiddenException("Votre profil conducteur n'est pas actif : contactez le support.");
    }

    await this.pin.assertPin(userId, pin, 'ACTIVATE_CUSTOMER_PROFILE');

    await this.prisma.customerProfile.create({
      data: {
        userId,
        firstName: driver.firstName,
        lastName: driver.lastName,
        photoUrl: driver.photoUrl,
        countryId: driver.countryId,
        cityId: driver.cityId,
        dateOfBirth: driver.dateOfBirth,
      },
    });
    await this.audit.log({ actorId: userId, entityType: 'User', entityId: userId, action: 'CUSTOMER_PROFILE_ACTIVATED' });
    return this.rolesOf(userId);
  }
}
