// backend/src/seed/accounts.seed.ts
import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AccountType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Comptes demandés explicitement par le client pour cet environnement —
 * PAS des comptes de démonstration génériques. Réexécutable sans risque
 * (upsert par email) : relancer ce script ne duplique rien et ne
 * change pas le mot de passe d'un compte déjà là si on ajuste la liste
 * plus tard, sauf pour les champs listés dans `update`.
 *
 * Mot de passe unique demandé pour les quatre comptes — appliqué tel
 * quel, haché avant stockage (jamais en clair, y compris ici).
 */
const SEED_PASSWORD = 'Lcd123456!';

interface SeedAccount {
  email: string;
  /** Format international. */
  phone: string;
  accountType: AccountType;
  /** Doit correspondre à une clé de rôle déjà créée par `npm run seed:rbac`. */
  roleKey: string;
}

const ACCOUNTS: SeedAccount[] = [
  {
    email: 'thiernodoniko@gmail.com',
    phone: '+33766736226',
    accountType: AccountType.SUPERADMIN,
    roleKey: 'superadmin',
  },
  {
    email: 'thierno.diallo99@sfr.fr',
    phone: '+33751244722',
    accountType: AccountType.SUPPORT,
    roleKey: 'support_agent',
  },
  {
    email: 'jallowdoniko@gmail.com',
    phone: '+33621158829',
    accountType: AccountType.SUPPORT,
    roleKey: 'support_supervisor',
  },
  {
    email: 'donikojallow@gmail.com',
    phone: '+33611435397',
    accountType: AccountType.SUPPORT,
    roleKey: 'finance_manager',
  },
];

@Injectable()
export class AccountsSeedService {
  private readonly logger = new Logger(AccountsSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async run(): Promise<void> {
    const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);

    for (const account of ACCOUNTS) {
      const role = await this.prisma.role.findUnique({ where: { key: account.roleKey } });
      if (!role) {
        this.logger.error(
          `Rôle "${account.roleKey}" introuvable — lancez d'abord "npm run seed:rbac". Compte ${account.email} ignoré.`,
        );
        continue;
      }

      const user = await this.prisma.user.upsert({
        where: { email: account.email },
        update: {
          phone: account.phone,
          passwordHash,
          accountType: account.accountType,
          isPhoneVerified: true,
          isActive: true,
          isSuspended: false,
        },
        create: {
          email: account.email,
          phone: account.phone,
          passwordHash,
          accountType: account.accountType,
          isPhoneVerified: true,
        },
      });

      // Même limitation que UserRolesService.assign() : la clé composite
      // @@unique([userId, roleId, countryId]) type `countryId` en `string`
      // non-nullable côté Prisma, incompatible avec un lookup `countryId: null`.
      // On passe donc par un findFirst + create explicite.
      const existingUserRole = await this.prisma.userRole.findFirst({
        where: { userId: user.id, roleId: role.id, countryId: null },
      });
      if (!existingUserRole) {
        await this.prisma.userRole.create({
          data: { userId: user.id, roleId: role.id },
        });
      }

      this.logger.log(`${account.email} → ${account.roleKey} (${account.accountType}, ${account.phone}) — synchronisé.`);
    }

    this.logger.log(
      `Terminé. Connexion : téléphone + OTP (immédiat, tous rôles) ou email + mot de passe "${SEED_PASSWORD}" ` +
        '(SUPERADMIN devra configurer la 2FA via /auth/2fa/setup avant que ce second mode ne fonctionne, section 3.1).',
    );
  }
}