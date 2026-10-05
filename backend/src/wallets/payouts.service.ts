// backend/src/wallets/payouts.service.ts
//
// Retraits des conducteurs. Deux voies, au choix du réglage « payout.auto_enabled » (page « Paramètres » du back-office) :
//  - AUTOMATIQUE (par défaut) : la demande est envoyée tout de suite au prestataire de paiement (Orange Money), sans validation du
//    support ; le conducteur est prévenu du résultat. Un plafond facultatif (payout.auto_max_amount) renvoie les gros montants
//    vers la validation manuelle.
//  - MANUELLE : la demande attend l'équipe, qui la marque « en traitement », « payée » ou « échouée » depuis le back-office. Ces
//    actions restent disponibles même en mode automatique, pour traiter un retrait resté bloqué.
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationChannel, NotificationType, PayoutStatus, Prisma } from '@prisma/client';
import * as Sentry from '@sentry/nestjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WalletsService } from './wallets.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/dto/pagination-response.dto';
import { formatMoneyWithCurrency, toMoneyBigInt } from '../common/utils/money.util';
import { RequestPayoutDto } from './dto/request-payout.dto';
import { PayoutProviderRegistry } from './providers/payout-provider.registry';

export interface PayoutAutoSettings {
  /** Retrait automatique activé (par défaut oui). */
  enabled: boolean;
  /** Au-dessus de ce montant (devise du portefeuille), validation manuelle ; 0 = aucune limite. */
  maxAmount: bigint;
}

/** Numéro masqué pour les messages : « ••••4417 ». */
function maskDestination(destination: string | null | undefined): string {
  const digits = (destination ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? `••••${digits.slice(-4)}` : 'votre compte Mobile Money';
}

/**
 * N'écrit jamais Wallet.balance/pendingBalance directement — toujours via
 * WalletsService.reserveForPayout / finalizePayout / reversePayout, seul
 * point d'écriture autorisé sur le portefeuille (voir wallets.service.ts).
 */
@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly wallets: WalletsService,
    private readonly providers: PayoutProviderRegistry,
    private readonly notifications: NotificationsService,
  ) {}

  async findOne(id: string) {
    const payout = await this.prisma.payout.findUnique({ where: { id } });
    if (!payout) throw new NotFoundException('Retrait introuvable.');
    return payout;
  }

  async findMineForDriver(driverId: string, query: PaginationQueryDto): Promise<PaginatedResult<unknown>> {
    const wallet = await this.wallets.findByDriverId(driverId);
    const where = { walletId: wallet.id };
    const [data, total] = await Promise.all([
      this.prisma.payout.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { requestedAt: 'desc' },
      }),
      this.prisma.payout.count({ where }),
    ]);
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  async findAll(
    query: PaginationQueryDto,
    filters: { status?: PayoutStatus } = {},
    /** Filtre de portée par pays (CountryScopeService) ; absent = aucune restriction. */
    scopeWhere?: Prisma.PayoutWhereInput,
  ): Promise<PaginatedResult<unknown>> {
    const baseWhere = { status: filters.status };
    const where = scopeWhere ? { AND: [baseWhere, scopeWhere] } : baseWhere;
    const [data, total] = await Promise.all([
      this.prisma.payout.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { requestedAt: 'desc' },
        include: { wallet: { include: { driver: true } } },
      }),
      this.prisma.payout.count({ where }),
    ]);
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  async request(driverId: string, dto: RequestPayoutDto) {
    const wallet = await this.wallets.findByDriverId(driverId);
    const amount = toMoneyBigInt(dto.amount);

    const payout = await this.prisma.payout.create({
      data: {
        walletId: wallet.id,
        amount,
        currencyId: wallet.currencyId,
        status: PayoutStatus.REQUESTED,
        method: dto.method,
        destinationRef: dto.destinationRef,
      },
    });

    // reserveForPayout valide le solde suffisant et bascule
    // balance -> pendingBalance ; si elle échoue, le Payout créé
    // ci-dessus doit être annulé pour ne pas laisser une demande
    // orpheline sans réservation de fonds derrière elle.
    try {
      await this.wallets.reserveForPayout(driverId, amount, payout.id);
    } catch (error) {
      await this.prisma.payout.update({
        where: { id: payout.id },
        data: { status: PayoutStatus.CANCELLED },
      });
      throw error;
    }

    // Retrait automatique : envoyé tout de suite au prestataire (sauf réglage contraire ou plafond dépassé). Le résultat — payé,
    // en cours, refusé, ou toujours en attente de l'équipe — est celui du retrait renvoyé au conducteur.
    return this.processAutomatically(payout.id);
  }

  // ---------------------------------------------------------------------------
  // Retrait automatique
  // ---------------------------------------------------------------------------

  /** Réglages lus à chaque demande : le SuperAdmin peut couper l'automatisme à tout moment, sans redéploiement. */
  async getAutoSettings(): Promise<PayoutAutoSettings> {
    const rows = await this.prisma.platformSetting.findMany({
      where: { key: { in: ['payout.auto_enabled', 'payout.auto_max_amount'] } },
    });
    const value = (key: string) => rows.find((row) => row.key === key)?.value;
    const maxRaw = value('payout.auto_max_amount');
    return {
      // Absent = activé : c'est le comportement voulu par défaut (la migration crée le réglage à « oui »).
      enabled: value('payout.auto_enabled') !== false,
      maxAmount: typeof maxRaw === 'number' && maxRaw > 0 ? BigInt(Math.floor(maxRaw)) : 0n,
    };
  }

  /**
   * Envoie le retrait au prestataire de paiement sans attendre l'équipe. Ne lève jamais d'exception vers le conducteur : quoi
   * qu'il arrive, sa demande existe et ses fonds sont réservés — le pire cas est un retrait « en attente » ou « en cours » que
   * l'équipe traite depuis le back-office.
   *
   *  - réglage coupé, montant au-dessus du plafond, numéro manquant → reste « demandé » (validation manuelle) ;
   *  - le prestataire dit PAYÉ → retrait payé, solde en attente décompté, conducteur prévenu ;
   *  - le prestataire dit REFUSÉ → retrait échoué, solde remis au conducteur, conducteur prévenu ;
   *  - le prestataire accepte sans confirmer → « en cours » (confirmation à venir) ;
   *  - erreur technique (résultat inconnu : l'argent est peut-être parti) → « en cours », JAMAIS remboursé automatiquement :
   *    l'équipe vérifie chez le prestataire avant de clôturer.
   */
  async processAutomatically(id: string) {
    const payout = await this.findOne(id);
    const settings = await this.getAutoSettings();

    // Réglage coupé volontairement : validation manuelle, rien à tracer (ce n'est pas une anomalie).
    if (!settings.enabled) return payout;

    // Cas qui renvoient vers la validation manuelle : on le trace pour que l'équipe sache pourquoi ce retrait attend.
    const manualReason =
      settings.maxAmount > 0n && payout.amount > settings.maxAmount
        ? 'MONTANT_AU_DESSUS_DU_PLAFOND'
        : !payout.destinationRef?.trim()
          ? 'DESTINATION_MANQUANTE'
          : null;
    if (manualReason) {
      await this.audit.log({ actorId: null, entityType: 'Payout', entityId: id, action: 'AUTO_SKIPPED', diff: { reason: manualReason } });
      return payout;
    }

    // Réclamer le retrait avant tout appel au prestataire : si l'équipe l'a déjà pris en charge, on n'envoie rien en double.
    const claimed = await this.prisma.payout.updateMany({
      where: { id, status: PayoutStatus.REQUESTED },
      data: { status: PayoutStatus.PROCESSING, autoProcessed: true },
    });
    if (claimed.count === 0) return this.findOne(id);

    const wallet = await this.prisma.wallet.findUniqueOrThrow({
      where: { id: payout.walletId },
      include: { currency: true },
    });

    try {
      const outcome = await this.providers.get().disburse({
        reference: id,
        amount: payout.amount,
        currencyIsoCode: wallet.currency.isoCode,
        method: payout.method ?? 'mobile_money',
        destination: payout.destinationRef as string,
      });

      if (outcome.status === 'PAID') {
        await this.closeAsPaid(id, null, { externalReference: outcome.externalReference });
        await this.notifyDriver(wallet.driverId, 'Retrait effectué', `${formatMoneyWithCurrency(payout.amount, wallet.currency.isoCode)} ont été envoyés sur votre compte Mobile Money (${maskDestination(payout.destinationRef)}).`);
      } else if (outcome.status === 'FAILED') {
        await this.closeAsFailed(id, outcome.reason, null, { externalReference: outcome.externalReference });
        await this.notifyDriver(wallet.driverId, 'Retrait refusé', `Votre retrait de ${formatMoneyWithCurrency(payout.amount, wallet.currency.isoCode)} a été refusé (${outcome.reason}). Le montant a été remis dans votre solde.`);
      } else {
        await this.prisma.payout.update({ where: { id }, data: { externalReference: outcome.externalReference } });
        await this.audit.log({ actorId: null, entityType: 'Payout', entityId: id, action: 'AUTO_PROCESSING', diff: { externalReference: outcome.externalReference } });
      }
    } catch (error) {
      // Résultat inconnu : on ne rembourse pas (l'argent est peut-être parti), on ne marque pas payé. L'équipe vérifie.
      this.logger.error(`Retrait ${id} : résultat inconnu après l'appel au prestataire — laissé « en cours » pour vérification.`, (error as Error).stack);
      Sentry.captureException(error);
      await this.audit.log({
        actorId: null,
        entityType: 'Payout',
        entityId: id,
        action: 'AUTO_ERROR',
        diff: { message: (error as Error).message },
      });
    }
    return this.findOne(id);
  }

  private async notifyDriver(driverId: string, title: string, body: string): Promise<void> {
    try {
      const driver = await this.prisma.driverProfile.findUnique({ where: { id: driverId }, select: { userId: true } });
      if (!driver) return;
      await this.notifications.notify({
        userId: driver.userId,
        type: NotificationType.DRIVER_PAYMENT,
        channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL],
        fallbackTitle: title,
        fallbackBody: body,
      });
    } catch (error) {
      // Une notification manquée ne doit jamais défaire un retrait déjà réglé.
      this.logger.warn(`Notification de retrait non envoyée : ${(error as Error).message}`);
    }
  }

  /** L'équipe marque le virement comme initié côté prestataire. */
  async markProcessing(id: string, actorId: string) {
    const payout = await this.findOne(id);
    if (payout.status !== PayoutStatus.REQUESTED) {
      throw new NotFoundException('Ce retrait ne peut pas être marqué en traitement.');
    }
    const updated = await this.prisma.payout.update({
      where: { id },
      data: { status: PayoutStatus.PROCESSING },
    });
    await this.audit.log({
      actorId,
      entityType: 'Payout',
      entityId: id,
      action: 'PROCESSING',
    });
    return updated;
  }

  /**
   * Un retrait ne se clôture qu'UNE fois : on « réclame » le statut avant de toucher au solde. Sans cela, un
   * double clic ou un rejeu ferait décompter deux fois le solde en attente, et un « échec » enregistré après un
   * « payé » remettrait au conducteur un argent déjà viré.
   */
  private async claimOpenPayout(id: string, next: PayoutStatus, extra: Prisma.PayoutUpdateManyMutationInput = {}) {
    const claimed = await this.prisma.payout.updateMany({
      where: { id, status: { in: [PayoutStatus.REQUESTED, PayoutStatus.PROCESSING] } },
      data: { status: next, ...extra },
    });
    if (claimed.count === 0) {
      throw new BadRequestException('Ce retrait est déjà clôturé (payé, échoué ou annulé).');
    }
  }

  /** Clôture « payé » : le solde en attente est décompté. Utilisé par l'équipe (markPaid) et par la voie automatique. */
  private async closeAsPaid(id: string, actorId: string | null, extra: { externalReference?: string } = {}) {
    const payout = await this.findOne(id);
    const wallet = await this.prisma.wallet.findUniqueOrThrow({ where: { id: payout.walletId } });

    await this.claimOpenPayout(id, PayoutStatus.PAID, { processedAt: new Date(), ...extra });
    try {
      await this.wallets.finalizePayout(wallet.driverId, payout.amount, id);
    } catch (error) {
      // Le solde n'a pas bougé : on rouvre le retrait pour qu'il puisse être retraité.
      await this.prisma.payout.update({ where: { id }, data: { status: payout.status, processedAt: null } });
      throw error;
    }
    const updated = await this.prisma.payout.findUniqueOrThrow({ where: { id } });
    await this.audit.log({
      actorId,
      entityType: 'Payout',
      entityId: id,
      action: 'PAID',
      ...(actorId === null ? { diff: { automatic: true, ...extra } } : {}),
    });
    return updated;
  }

  /** Clôture « échoué » : le solde réservé est remis au conducteur. Utilisé par l'équipe (markFailed) et par la voie automatique. */
  private async closeAsFailed(
    id: string,
    reason: string,
    actorId: string | null,
    extra: { externalReference?: string } = {},
  ) {
    const payout = await this.findOne(id);
    const wallet = await this.prisma.wallet.findUniqueOrThrow({ where: { id: payout.walletId } });

    await this.claimOpenPayout(id, PayoutStatus.FAILED, { failureReason: reason, ...extra });
    try {
      await this.wallets.reversePayout(wallet.driverId, payout.amount, id);
    } catch (error) {
      await this.prisma.payout.update({ where: { id }, data: { status: payout.status, failureReason: null } });
      throw error;
    }
    const updated = await this.prisma.payout.findUniqueOrThrow({ where: { id } });
    await this.audit.log({
      actorId,
      entityType: 'Payout',
      entityId: id,
      action: 'FAILED',
      diff: { reason, ...(actorId === null ? { automatic: true } : {}) },
    });
    return updated;
  }

  async markPaid(id: string, actorId: string) {
    return this.closeAsPaid(id, actorId);
  }

  async markFailed(id: string, reason: string, actorId: string) {
    return this.closeAsFailed(id, reason, actorId);
  }
}