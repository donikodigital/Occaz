// backend/src/staff-accounts/staff-accounts.service.ts
// [20/10/2026] v1 — Création des comptes d'équipe (Support, Superviseur, Finance…) depuis le back-office, par le SuperAdmin uniquement.
//
//  • Le compte est créé SANS mot de passe : le SuperAdmin ne connaît ni ne choisit jamais le mot de passe de quelqu'un d'autre.
//  • Un e-mail de bienvenue part aussitôt : lien du site, identifiant de connexion (adresse e-mail), numéro enregistré, et un lien personnel
//    à usage unique (7 jours) pour choisir son mot de passe. Le jeton n'est jamais stocké en clair (HMAC, comme les codes OTP).
//  • Le rôle « superadmin » ne s'attribue pas d'ici : un seul compte sans limite de droits, créé hors du back-office (seed).
//  • « Pays » = portée du rôle : une attribution (UserRole) par pays choisi, ou une seule attribution sans pays = tous les pays.
//  • Si l'e-mail n'a pas pu partir, le compte existe quand même : la réponse l'indique et « Renvoyer l'invitation » refait un envoi.
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  Inject,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { AccountType, OtpPurpose, OtpStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EMAIL_PROVIDER, EmailProvider } from '../integrations/email/email-provider.interface';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { hashOtpCode } from '../common/utils/otp.util';
import { SUPERADMIN_ROLE_KEY } from '../rbac/user-roles.service';
import { CreateStaffAccountDto } from './dto/create-staff-account.dto';

export const INVITATION_VALIDITY_DAYS = 7;
const DAY_MS = 86_400_000;
const LIST_LIMIT = 200;

export type StaffAccountStatus = 'ACTIVE' | 'INVITED' | 'INVITATION_EXPIRED';

export interface StaffAccountSummary {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string;
  address: string | null;
  isSuspended: boolean;
  status: StaffAccountStatus;
  createdAt: Date;
  roles: Array<{
    key: string;
    name: string;
    /** Vrai si le rôle s'exerce dans tous les pays. */
    allCountries: boolean;
    countries: Array<{ id: string; name: string; isoCode: string }>;
  }>;
}

export interface CreateStaffAccountResult {
  account: StaffAccountSummary;
  /** Faux si l'e-mail de bienvenue n'a pas pu partir : le compte existe, l'invitation peut être renvoyée. */
  invitationSent: boolean;
}

/** Jeton du lien : 256 bits aléatoires, lisible dans une URL. */
export function generateInvitationToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Numéro tel que stocké : sans espaces, tirets ni parenthèses. */
export function normalizePhone(phone: string): string {
  return phone.replace(/[\s().-]/g, '');
}

type UserWithStaffData = Prisma.UserGetPayload<{
  include: { staffProfile: true; userRoles: { include: { role: true; country: true } } };
}>;

@Injectable()
export class StaffAccountsService {
  private readonly logger = new Logger(StaffAccountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
  ) {}

  private assertSuperAdmin(actor: AuthenticatedUser): void {
    if (actor.accountType !== AccountType.SUPERADMIN) {
      throw new ForbiddenException('Seul le SuperAdmin peut créer et gérer les comptes d\'équipe.');
    }
  }

  /** Adresse du back-office, sans « / » final. Sans elle, l'e-mail n'aurait aucun lien : on refuse avant de créer quoi que ce soit. */
  private panelUrl(): string {
    const url = process.env.ADMIN_PANEL_URL?.trim().replace(/\/+$/, '');
    if (!url || !/^https?:\/\//i.test(url)) {
      throw new ServiceUnavailableException(
        "L'adresse du back-office (ADMIN_PANEL_URL) n'est pas configurée sur le serveur : l'e-mail d'invitation n'aurait aucun lien.",
      );
    }
    return url;
  }

  async create(dto: CreateStaffAccountDto, actor: AuthenticatedUser): Promise<CreateStaffAccountResult> {
    this.assertSuperAdmin(actor);
    const panelUrl = this.panelUrl();

    const email = dto.email.trim().toLowerCase();
    const phone = normalizePhone(dto.phone);
    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();
    const address = dto.address?.trim() || null;
    const countryIds = [...new Set(dto.countryIds ?? [])];

    const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
    if (!role) throw new NotFoundException('Rôle introuvable.');
    if (role.key === SUPERADMIN_ROLE_KEY) {
      throw new ForbiddenException('Le rôle SuperAdmin ne peut pas être attribué depuis cette page.');
    }

    if (countryIds.length > 0) {
      const found = await this.prisma.country.count({ where: { id: { in: countryIds } } });
      if (found !== countryIds.length) throw new NotFoundException('Un des pays choisis est introuvable.');
    }

    const clash = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] },
      select: { email: true, phone: true },
    });
    if (clash) {
      throw new ConflictException(
        clash.email === email ? 'Un compte utilise déjà cette adresse e-mail.' : 'Un compte utilise déjà ce numéro de téléphone.',
      );
    }

    let userId: string;
    try {
      userId = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            phone,
            email,
            accountType: AccountType.SUPPORT,
            // Le numéro est saisi par le SuperAdmin : aucun SMS à envoyer à l'équipe. L'e-mail, lui, se vérifie à l'ouverture du lien.
            isPhoneVerified: true,
            staffProfile: { create: { firstName, lastName, address } },
          },
          select: { id: true },
        });
        await tx.userRole.createMany({
          data: (countryIds.length > 0 ? countryIds : [null]).map((countryId) => ({ userId: user.id, roleId: role.id, countryId })),
        });
        return user.id;
      });
    } catch (error) {
      // Deux créations simultanées avec la même adresse ou le même numéro : la base tranche.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Un compte utilise déjà cette adresse e-mail ou ce numéro de téléphone.');
      }
      throw error;
    }

    const user = await this.loadWithStaffData(userId);
    const invitationSent = await this.sendInvitation(user, panelUrl);

    await this.audit.log({
      actorId: actor.id,
      entityType: 'User',
      entityId: userId,
      action: 'STAFF_ACCOUNT_CREATE',
      diff: { email, roleKey: role.key, countryIds, invitationSent },
    });

    return { account: this.toSummary(user, invitationSent), invitationSent };
  }

  async list(actor: AuthenticatedUser): Promise<StaffAccountSummary[]> {
    this.assertSuperAdmin(actor);
    const users = await this.prisma.user.findMany({
      where: { accountType: AccountType.SUPPORT },
      include: { staffProfile: true, userRoles: { include: { role: true, country: true } } },
      orderBy: { createdAt: 'desc' },
      take: LIST_LIMIT,
    });
    if (users.length === 0) return [];

    const pending = await this.prisma.otpCode.findMany({
      where: {
        userId: { in: users.map((user) => user.id) },
        purpose: OtpPurpose.STAFF_INVITATION,
        status: OtpStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
      select: { userId: true },
    });
    const invited = new Set(pending.map((row) => row.userId));
    return users.map((user) => this.toSummary(user, invited.has(user.id)));
  }

  async resendInvitation(userId: string, actor: AuthenticatedUser): Promise<{ invitationSent: true }> {
    this.assertSuperAdmin(actor);
    const panelUrl = this.panelUrl();
    const user = await this.loadWithStaffData(userId).catch(() => null);
    if (!user || user.accountType !== AccountType.SUPPORT) throw new NotFoundException('Compte d\'équipe introuvable.');
    if (user.passwordHash) {
      throw new BadRequestException('Ce compte a déjà choisi son mot de passe. En cas d\'oubli, la page de connexion propose « Mot de passe oublié ».');
    }
    if (!user.email) throw new BadRequestException('Ce compte n\'a pas d\'adresse e-mail.');
    if (user.isSuspended) throw new BadRequestException('Ce compte est suspendu.');

    if (!(await this.sendInvitation(user, panelUrl))) {
      throw new ServiceUnavailableException("L'e-mail n'a pas pu être envoyé. Réessayez dans un instant.");
    }
    await this.audit.log({ actorId: actor.id, entityType: 'User', entityId: user.id, action: 'STAFF_INVITATION_RESEND' });
    return { invitationSent: true };
  }

  // ---------------------------------------------------------------------
  // Lien public : voir le compte attendu, puis choisir le mot de passe
  // ---------------------------------------------------------------------

  /** Ce que la page « Choisir mon mot de passe » affiche avant la saisie. Même erreur pour tout lien inutilisable. */
  async inspectInvitation(token: string): Promise<{ firstName: string | null; email: string }> {
    const found = await this.findUsableInvitation(token);
    return { firstName: found.user.staffProfile?.firstName ?? null, email: found.user.email! };
  }

  async acceptInvitation(token: string, newPassword: string): Promise<{ message: string }> {
    const found = await this.findUsableInvitation(token);
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Usage unique : si deux requêtes portent le même lien en même temps, une seule passe.
    const consumed = await this.prisma.otpCode.updateMany({
      where: { id: found.otpId, status: OtpStatus.PENDING, expiresAt: { gt: new Date() } },
      data: { status: OtpStatus.VERIFIED, verifiedAt: new Date() },
    });
    if (consumed.count === 0) throw new BadRequestException(INVALID_LINK_MESSAGE);

    await this.prisma.user.update({
      where: { id: found.user.id },
      data: { passwordHash, isEmailVerified: true, failedLoginAttempts: 0, lockedUntil: null },
    });
    await this.audit.log({
      actorId: found.user.id,
      entityType: 'User',
      entityId: found.user.id,
      action: 'STAFF_PASSWORD_SET',
    });
    return { message: 'Mot de passe enregistré. Vous pouvez maintenant vous connecter.' };
  }

  private async findUsableInvitation(token: string) {
    const otp = await this.prisma.otpCode.findFirst({
      where: { purpose: OtpPurpose.STAFF_INVITATION, status: OtpStatus.PENDING, code: hashOtpCode(token), expiresAt: { gt: new Date() } },
      select: { id: true, userId: true },
    });
    if (!otp?.userId) throw new BadRequestException(INVALID_LINK_MESSAGE);

    const user = await this.prisma.user.findUnique({ where: { id: otp.userId }, include: { staffProfile: true } });
    if (!user || user.accountType !== AccountType.SUPPORT || !user.email || user.isSuspended) {
      throw new BadRequestException(INVALID_LINK_MESSAGE);
    }
    return { otpId: otp.id, user };
  }

  // ---------------------------------------------------------------------
  // Invitation par e-mail
  // ---------------------------------------------------------------------

  private loadWithStaffData(userId: string): Promise<UserWithStaffData> {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { staffProfile: true, userRoles: { include: { role: true, country: true } } },
    });
  }

  /** Remplace l'éventuelle invitation en attente par une nouvelle, puis l'envoie. Faux si l'e-mail n'est pas parti (rien n'est conservé alors). */
  private async sendInvitation(user: UserWithStaffData, panelUrl: string): Promise<boolean> {
    if (!user.email) return false;

    await this.prisma.otpCode.updateMany({
      where: { userId: user.id, purpose: OtpPurpose.STAFF_INVITATION, status: OtpStatus.PENDING },
      data: { status: OtpStatus.EXPIRED },
    });

    const token = generateInvitationToken();
    const otp = await this.prisma.otpCode.create({
      data: {
        userId: user.id,
        code: hashOtpCode(token),
        purpose: OtpPurpose.STAFF_INVITATION,
        status: OtpStatus.PENDING,
        maxAttempts: 1,
        expiresAt: new Date(Date.now() + INVITATION_VALIDITY_DAYS * DAY_MS),
      },
    });

    const setPasswordUrl = `${panelUrl}/definir-mot-de-passe?token=${encodeURIComponent(token)}`;
    try {
      await this.emailProvider.send(
        user.email,
        'Bienvenue dans l\'équipe Occa\'Z — activez votre compte',
        buildInvitationBody({
          firstName: user.staffProfile?.firstName ?? null,
          email: user.email,
          phone: user.phone,
          siteUrl: panelUrl,
          setPasswordUrl,
          roles: this.toSummary(user, true).roles,
        }),
        { url: setPasswordUrl, label: 'Choisir mon mot de passe' },
      );
      return true;
    } catch (error) {
      await this.prisma.otpCode.delete({ where: { id: otp.id } }).catch(() => undefined);
      this.logger.error(`E-mail d'invitation non envoyé (compte ${user.id}) : ${(error as Error).message}`);
      return false;
    }
  }

  private toSummary(user: UserWithStaffData, hasPendingInvitation: boolean): StaffAccountSummary {
    const byRole = new Map<string, StaffAccountSummary['roles'][number]>();
    for (const assignment of user.userRoles) {
      const entry =
        byRole.get(assignment.role.key) ??
        { key: assignment.role.key, name: assignment.role.name, allCountries: false, countries: [] };
      if (assignment.country) {
        entry.countries.push({ id: assignment.country.id, name: assignment.country.name, isoCode: assignment.country.isoCode });
      } else {
        entry.allCountries = true;
      }
      byRole.set(assignment.role.key, entry);
    }

    const status: StaffAccountStatus = user.passwordHash ? 'ACTIVE' : hasPendingInvitation ? 'INVITED' : 'INVITATION_EXPIRED';
    return {
      id: user.id,
      firstName: user.staffProfile?.firstName ?? null,
      lastName: user.staffProfile?.lastName ?? null,
      email: user.email,
      phone: user.phone,
      address: user.staffProfile?.address ?? null,
      isSuspended: user.isSuspended,
      status,
      createdAt: user.createdAt,
      roles: [...byRole.values()],
    };
  }
}

const INVALID_LINK_MESSAGE = 'Ce lien n\'est plus valide (déjà utilisé ou expiré). Demandez au SuperAdmin de vous renvoyer une invitation.';

/** Texte de l'e-mail de bienvenue (le gabarit HTML y ajoute le bouton « Choisir mon mot de passe »). */
export function buildInvitationBody(params: {
  firstName: string | null;
  email: string;
  phone: string;
  siteUrl: string;
  setPasswordUrl: string;
  roles: StaffAccountSummary['roles'];
}): string {
  const scope = params.roles
    .map((role) => `${role.name} (${role.allCountries || role.countries.length === 0 ? 'tous les pays' : role.countries.map((c) => c.name).join(', ')})`)
    .join(' ; ');
  return [
    `Bonjour${params.firstName ? ` ${params.firstName}` : ''},`,
    '',
    `Un compte vient de vous être créé sur le back-office Occa'Z${scope ? ` — rôle : ${scope}` : ''}.`,
    '',
    `Site : ${params.siteUrl}`,
    `Identifiant de connexion : ${params.email}`,
    `Téléphone enregistré : ${params.phone}`,
    '',
    `Pour vous connecter, utilisez votre adresse e-mail avec le mot de passe que vous allez choisir. Ouvrez le lien ci-dessous pour le définir (valable ${INVITATION_VALIDITY_DAYS} jours, utilisable une seule fois) :`,
    params.setPasswordUrl,
    '',
    "Si vous n'attendiez pas ce message, ignorez-le et prévenez l'administrateur.",
  ].join('\n');
}
