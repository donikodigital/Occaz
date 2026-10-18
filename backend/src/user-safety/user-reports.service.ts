// backend/src/user-safety/user-reports.service.ts
// [16/10/2026] v2 — remind() : message de rappel du support à la personne signalée (ou à celle qui a signalé), tracé dans le journal d'audit.
// [11/10/2026] v1 — signalement d'un utilisateur par un autre, puis traitement par le support (statut + note, tracés dans le journal d'audit).
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountType, NotificationType, Prisma, UserReportStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/dto/pagination-response.dto';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { UserBlocksService } from './user-blocks.service';
import { CreateUserReportDto, RemindUserReportDto, UpdateUserReportDto } from './dto/user-safety.dto';
import { REPORT_REASON_LABELS, fullName } from './user-safety.utils';

/** Au plus ce nombre de signalements par personne et par jour : freine les signalements en rafale. */
export const MAX_REPORTS_PER_DAY = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

const PARTY_SELECT = {
  id: true,
  phone: true,
  email: true,
  accountType: true,
  isSuspended: true,
  customerProfile: { select: { firstName: true, lastName: true } },
  driverProfile: { select: { firstName: true, lastName: true } },
} satisfies Prisma.UserSelect;

@Injectable()
export class UserReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blocks: UserBlocksService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async create(reporterId: string, dto: CreateUserReportDto) {
    const reportedUserId = await this.blocks.resolveTargetUserId(dto);
    if (reporterId === reportedUserId) throw new BadRequestException('Vous ne pouvez pas vous signaler vous-même.');

    const target = await this.prisma.user.findFirst({
      where: { id: reportedUserId, deletedAt: null },
      select: { id: true, accountType: true },
    });
    if (!target) throw new NotFoundException('Utilisateur introuvable.');
    if (target.accountType === AccountType.SUPPORT || target.accountType === AccountType.SUPERADMIN) {
      throw new ForbiddenException("Ce compte ne peut pas être signalé ici. Contactez le support depuis l'aide.");
    }

    const since = new Date(Date.now() - DAY_MS);

    // Déjà signalé aujourd'hui et pas encore traité : on ne crée pas de doublon, on confirme simplement.
    const duplicate = await this.prisma.userReport.findFirst({
      where: {
        reporterId,
        reportedUserId,
        status: { in: [UserReportStatus.OPEN, UserReportStatus.IN_REVIEW] },
        createdAt: { gte: since },
      },
      select: { id: true },
    });
    if (duplicate) {
      if (dto.alsoBlock) await this.blocks.block(reporterId, reportedUserId);
      return { id: duplicate.id, alreadyReported: true, blocked: Boolean(dto.alsoBlock) };
    }

    const recent = await this.prisma.userReport.count({ where: { reporterId, createdAt: { gte: since } } });
    if (recent >= MAX_REPORTS_PER_DAY) {
      throw new BadRequestException("Vous avez atteint le nombre maximal de signalements pour aujourd'hui.");
    }

    const report = await this.prisma.userReport.create({
      data: {
        reporterId,
        reportedUserId,
        reason: dto.reason,
        details: dto.details?.trim() || null,
        tripId: dto.tripId,
        bookingId: dto.bookingId,
        shipmentId: dto.shipmentId,
      },
      select: { id: true },
    });

    if (dto.alsoBlock) await this.blocks.block(reporterId, reportedUserId);

    await this.notifications.notifyStaff({
      permission: PERMISSIONS.USER_REPORT_READ,
      type: NotificationType.SAFETY,
      title: 'Nouveau signalement',
      body: `${REPORT_REASON_LABELS[dto.reason]} — à examiner.`,
      link: '/reports',
      payload: { reportId: report.id },
    });

    return { id: report.id, alreadyReported: false, blocked: Boolean(dto.alsoBlock) };
  }

  async findAll(
    query: PaginationQueryDto,
    filters: { status?: UserReportStatus; reportedUserId?: string },
    scopeWhere?: Prisma.UserWhereInput,
  ) {
    const where: Prisma.UserReportWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.reportedUserId ? { reportedUserId: filters.reportedUserId } : {}),
      ...(scopeWhere ? { reportedUser: scopeWhere } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.userReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
        include: {
          reporter: { select: PARTY_SELECT },
          reportedUser: { select: PARTY_SELECT },
        },
      }),
      this.prisma.userReport.count({ where }),
    ]);

    // Combien de fois chaque personne signalée l'a été (hors signalements rejetés) : le chiffre qui aide à décider.
    const reportedIds = [...new Set(rows.map((row) => row.reportedUserId))];
    const counts = reportedIds.length
      ? await this.prisma.userReport.groupBy({
          by: ['reportedUserId'],
          where: { reportedUserId: { in: reportedIds }, status: { not: UserReportStatus.DISMISSED } },
          _count: { _all: true },
        })
      : [];
    const countByUser = new Map(counts.map((row) => [row.reportedUserId, row._count._all]));

    const data = rows.map((row) => ({
      id: row.id,
      reason: row.reason,
      reasonLabel: REPORT_REASON_LABELS[row.reason],
      details: row.details,
      status: row.status,
      resolutionNote: row.resolutionNote,
      tripId: row.tripId,
      bookingId: row.bookingId,
      shipmentId: row.shipmentId,
      handledAt: row.handledAt,
      createdAt: row.createdAt,
      reporter: { id: row.reporter.id, name: fullName(row.reporter), phone: row.reporter.phone },
      reportedUser: {
        id: row.reportedUser.id,
        name: fullName(row.reportedUser),
        phone: row.reportedUser.phone,
        accountType: row.reportedUser.accountType,
        isSuspended: row.reportedUser.isSuspended,
        reportCount: countByUser.get(row.reportedUserId) ?? 0,
      },
    }));
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  async update(id: string, dto: UpdateUserReportDto, actorId: string) {
    const existing = await this.prisma.userReport.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!existing) throw new NotFoundException('Signalement introuvable.');

    const closing = dto.status === UserReportStatus.RESOLVED || dto.status === UserReportStatus.DISMISSED;
    const updated = await this.prisma.userReport.update({
      where: { id },
      data: {
        status: dto.status,
        resolutionNote: dto.resolutionNote?.trim() || undefined,
        handledById: actorId,
        handledAt: closing ? new Date() : null,
      },
      select: { id: true, status: true, resolutionNote: true, handledAt: true },
    });

    await this.audit.log({
      actorId,
      entityType: 'UserReport',
      entityId: id,
      action: 'user_report.update',
      diff: { from: existing.status, to: dto.status },
    });
    return updated;
  }

  /** Identifiant du compte signalé : sert au contrôle de périmètre (pays) avant d'agir sur le signalement. */
  async reportedUserIdOf(id: string): Promise<string> {
    const report = await this.prisma.userReport.findUnique({ where: { id }, select: { reportedUserId: true } });
    if (!report) throw new NotFoundException('Signalement introuvable.');
    return report.reportedUserId;
  }

  /**
   * Message de rappel du service client, après un signalement : une notification dans l'application de la personne signalée (rappel des
   * règles, avertissement) ou de celle qui a signalé (suite donnée). Le texte est celui de l'agent ; l'envoi est tracé.
   */
  async remind(id: string, dto: RemindUserReportDto, actorId: string): Promise<{ sent: true }> {
    const report = await this.prisma.userReport.findUnique({
      where: { id },
      select: { id: true, reporterId: true, reportedUserId: true },
    });
    if (!report) throw new NotFoundException('Signalement introuvable.');

    const recipientId = dto.recipient === 'REPORTED' ? report.reportedUserId : report.reporterId;
    const message = dto.message.trim();
    if (message.length < 10) throw new BadRequestException('Le message est trop court.');

    await this.notifications.notify({
      userId: recipientId,
      type: NotificationType.SUPPORT_MESSAGE,
      fallbackTitle: 'Message du service client',
      fallbackBody: message,
      payload: { reportId: report.id },
      pushData: { type: 'SUPPORT_MESSAGE', reportId: report.id },
    });

    await this.audit.log({
      actorId,
      entityType: 'UserReport',
      entityId: id,
      action: 'user_report.remind',
      diff: { recipient: dto.recipient, recipientId },
    });
    return { sent: true };
  }

  /** Nombre de signalements en attente (pastille du back-office). */
  async openCount(): Promise<{ count: number }> {
    const count = await this.prisma.userReport.count({
      where: { status: { in: [UserReportStatus.OPEN, UserReportStatus.IN_REVIEW] } },
    });
    return { count };
  }
}
