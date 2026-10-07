// backend/src/wallets/payouts.service.ts
//
// Retraits des conducteurs. Deux modes, au choix du réglage « payout.auto_enabled » (page « Retraits » du back-office) :
//  - AUTOMATIQUE (par défaut) : la demande est envoyée tout de suite au prestataire de paiement (Orange Money), sans validation du
//    support ; le conducteur est prévenu du résultat. Un plafond facultatif (payout.auto_max_amount) renvoie les gros montants
//    vers la validation manuelle.
//  - MANUEL : la demande reste « en attente de validation » (statut REQUESTED), le solde est réservé, et l'équipe est alertée
//    (cloche + email). L'admin vérifie d'abord que son compte de paiement est approvisionné, puis :
//      · « Valider et envoyer » (approve) : le virement part par le prestataire de paiement ;
//      · ou « Passer en traitement » (markProcessing), fait le virement lui-même, puis « Marquer payé » (markPaid) ;
//      · ou refuse (markFailed) : le solde est remis au conducteur.
//    Chaque décision prévient le conducteur. Ces actions restent disponibles même en mode automatique, pour traiter un retrait
//    resté bloqué.
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

/** Ce que la page « Retraits » du back-office affiche en tête : le mode, le plafond, l'état du prestataire et la file d'attente. */
export interface PayoutConfig {
  /** true = automatique, false = manuel (chaque retrait attend la validation de l'équipe). */
  autoEnabled: boolean;
  /** Plafond du mode automatique, plus petite unité de la devise (« 0 » = aucune limite). Texte : un BigInt ne passe pas en JSON. */
  autoMaxAmount: string;
  /** Vrai tant qu'aucun prestataire réel n'est branché : un « envoi » ne fait alors partir aucun argent. */
  providerSimulated: boolean;
  /** Retraits en attente de validation (dans la portée de l'équipier qui consulte). */
  pendingCount: number;
}

const AUTO_ENABLED_KEY = 'payout.auto_enabled';
const AUTO_MAX_AMOUNT_KEY = 'payout.auto_max_amount';

/** Numéro masqué pour les messages : « ••••4417 ». */
function maskDestination(destination: string | null | undefined): string {
  const digits = (destination ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? `••••${digits.slice(-4)}` : 'votre compte Mobile Money';
}

type PayoutMessageKind = 'VALIDATED' | 'PAID' | 'FAILED';

/** Texte envoyé au conducteur : le même quel que soit celui qui a décidé (automatique ou équipe). */
function payoutMessage(kind: PayoutMessageKind, amount: string, masked: string, reason?: string): { title: string; body: string } {
  switch (kind) {
    case 'PAID':
      return { title: 'Retrait effectué', body: `${amount} ont été envoyés sur votre compte Mobile Money (${masked}).` };
    case 'FAILED':
      return {
        title: 'Retrait refusé',
        body: `Votre retrait de ${amount} a été refusé (${reason ?? 'raison non précisée'}). Le montant a été remis dans votre solde.`,
      };
    case 'VALIDATED':
      return { title: 'Retrait validé', body: `Votre retrait de ${amount} a été validé : l'envoi vers ${masked} est en cours.` };
  }
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
        // La devise du retrait (GNF, XOF…) : l'admin valide un montant, il doit le voir dans la bonne devise.
        include: { currency: true, wallet: { include: { driver: true } } },
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

    // Retrait automatique : envoyé tout de suite au prestataire (sauf mode manuel ou plafond dépassé). Le résultat — payé,
    // en cours, refusé, ou toujours en attente de l'équipe — est celui du retrait renvoyé au conducteur.
    const result = await this.processAutomatically(payout.id);

    // Resté « en attente de validation » (mode manuel, montant au-dessus du plafond, numéro manquant) : l'équipe doit le traiter.
    if (result.status === PayoutStatus.REQUESTED) {
      await this.alertStaffOfPendingPayout(payout.id, result.amount, wallet.currency?.isoCode ?? '');
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // Mode des retraits (page « Retraits » du back-office)
  // ---------------------------------------------------------------------------

  /** Réglages lus à chaque demande : le SuperAdmin peut changer de mode à tout moment, sans redéploiement. */
  async getAutoSettings(): Promise<PayoutAutoSettings> {
    const rows = await this.prisma.platformSetting.findMany({
      where: { key: { in: [AUTO_ENABLED_KEY, AUTO_MAX_AMOUNT_KEY] } },
    });
    const value = (key: string) => rows.find((row) => row.key === key)?.value;
    const maxRaw = value(AUTO_MAX_AMOUNT_KEY);
    return {
      // Absent = activé : c'est le comportement voulu par défaut (la migration crée le réglage à « oui »).
      enabled: value(AUTO_ENABLED_KEY) !== false,
      maxAmount: typeof maxRaw === 'number' && maxRaw > 0 ? BigInt(Math.floor(maxRaw)) : 0n,
    };
  }

  /** Mode courant + file d'attente, pour l'en-tête de la page « Retraits ». */
  async getConfig(scopeWhere?: Prisma.PayoutWhereInput): Promise<PayoutConfig> {
    const settings = await this.getAutoSettings();
    const pendingBase = { status: PayoutStatus.REQUESTED };
    const pendingCount = await this.prisma.payout.count({ where: scopeWhere ? { AND: [pendingBase, scopeWhere] } : pendingBase });
    return {
      autoEnabled: settings.enabled,
      autoMaxAmount: settings.maxAmount.toString(),
      providerSimulated: this.providers.get().isSimulated,
      pendingCount,
    };
  }

  /**
   * Bascule Automatique / Manuel. Écrit le même réglage que la page « Paramètres » (une seule source de vérité) et trace le
   * changement : savoir qui a coupé l'automatisme, et quand, compte pour un flux d'argent. N'affecte que les retraits à venir —
   * ceux déjà en attente le restent jusqu'à décision de l'équipe.
   */
  async setMode(autoEnabled: boolean, actorId: string): Promise<void> {
    const setting = await this.prisma.platformSetting.upsert({
      where: { key: AUTO_ENABLED_KEY },
      update: { value: autoEnabled, updatedById: actorId },
      create: {
        key: AUTO_ENABLED_KEY,
        value: autoEnabled,
        description:
          "Retrait automatique : le retrait d'un conducteur est envoyé tout de suite sur son compte Mobile Money, sans validation de l'équipe. Désactiver pour passer en validation manuelle.",
        updatedById: actorId,
      },
    });
    await this.audit.log({
      actorId,
      entityType: 'PlatformSetting',
      entityId: setting.id,
      action: 'UPSERT',
      diff: { key: AUTO_ENABLED_KEY, value: autoEnabled } as Prisma.InputJsonValue,
    });
  }

  // ---------------------------------------------------------------------------
  // Retrait automatique
  // ---------------------------------------------------------------------------

  /**
   * Envoie le retrait au prestataire de paiement sans attendre l'équipe. Ne lève jamais d'exception vers le conducteur : quoi
   * qu'il arrive, sa demande existe et ses fonds sont réservés — le pire cas est un retrait « en attente » ou « en cours » que
   * l'équipe traite depuis le back-office.
   *
   *  - mode manuel, montant au-dessus du plafond, numéro manquant → reste « en attente de validation » ;
   *  - le prestataire dit PAYÉ → retrait payé, solde en attente décompté, conducteur prévenu ;
   *  - le prestataire dit REFUSÉ → retrait échoué, solde remis au conducteur, conducteur prévenu ;
   *  - le prestataire accepte sans confirmer → « en cours » (confirmation à venir) ;
   *  - erreur technique (résultat inconnu : l'argent est peut-être parti) → « en cours », JAMAIS remboursé automatiquement :
   *    l'équipe vérifie chez le prestataire avant de clôturer.
   */
  async processAutomatically(id: string) {
    const payout = await this.findOne(id);
    const settings = await this.getAutoSettings();

    // Mode manuel choisi volontairement : validation par l'équipe, rien à tracer (ce n'est pas une anomalie).
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

    return this.sendToProvider(payout, null);
  }

  /**
   * Validation par l'équipe : le virement part tout de suite par le prestataire de paiement, comme en mode automatique, mais
   * seulement une fois que l'admin a vérifié que son compte est approvisionné. Refusée s'il n'y a pas de prestataire réel en
   * production : « envoyer » marquerait le retrait payé sans qu'aucun argent ne parte (voir PayoutProviderRegistry).
   */
  async approve(id: string, actorId: string) {
    const payout = await this.findOne(id);
    if (payout.status !== PayoutStatus.REQUESTED) {
      throw new BadRequestException('Seul un retrait en attente de validation peut être validé.');
    }
    if (!payout.destinationRef?.trim()) {
      throw new BadRequestException("Ce retrait n'a pas de numéro Mobile Money : refuse-le, le conducteur pourra réessayer avec un numéro.");
    }
    if (this.providers.get().isSimulated && process.env.NODE_ENV === 'production') {
      throw new BadRequestException(
        "Orange Money n'est pas encore branché : un envoi serait marqué payé sans qu'aucun argent ne parte. Passe le retrait en traitement, fais le virement toi-même, puis marque-le payé.",
      );
    }
    return this.sendToProvider(payout, actorId);
  }

  /**
   * Envoi au prestataire, commun au mode automatique (`actorId` nul) et à la validation par l'équipe. Le retrait est « réclamé »
   * avant tout appel au prestataire : si quelqu'un l'a déjà pris en charge, rien n'est envoyé en double.
   */
  private async sendToProvider(payout: { id: string; walletId: string; amount: bigint; method: string | null; destinationRef: string | null }, actorId: string | null) {
    const id = payout.id;
    const automatic = actorId === null;
    const prefix = automatic ? 'AUTO' : 'APPROVED';

    const claimed = await this.prisma.payout.updateMany({
      where: { id, status: PayoutStatus.REQUESTED },
      data: { status: PayoutStatus.PROCESSING, autoProcessed: automatic },
    });
    if (claimed.count === 0) {
      if (!automatic) throw new BadRequestException('Ce retrait a déjà été pris en charge.');
      return this.findOne(id);
    }
    if (!automatic) {
      await this.audit.log({ actorId, entityType: 'Payout', entityId: id, action: 'APPROVED' });
    }

    const wallet = await this.prisma.wallet.findUniqueOrThrow({
      where: { id: payout.walletId },
      include: { currency: true },
    });
    const amountText = formatMoneyWithCurrency(payout.amount, wallet.currency.isoCode);
    const masked = maskDestination(payout.destinationRef);

    try {
      const outcome = await this.providers.get().disburse({
        reference: id,
        amount: payout.amount,
        currencyIsoCode: wallet.currency.isoCode,
        method: payout.method ?? 'mobile_money',
        destination: payout.destinationRef as string,
      });

      if (outcome.status === 'PAID') {
        await this.closeAsPaid(id, actorId, { externalReference: outcome.externalReference });
        const message = payoutMessage('PAID', amountText, masked);
        await this.notifyDriver(wallet.driverId, message.title, message.body);
      } else if (outcome.status === 'FAILED') {
        await this.closeAsFailed(id, outcome.reason, actorId, { externalReference: outcome.externalReference });
        const message = payoutMessage('FAILED', amountText, masked, outcome.reason);
        await this.notifyDriver(wallet.driverId, message.title, message.body);
      } else {
        await this.prisma.payout.update({ where: { id }, data: { externalReference: outcome.externalReference } });
        await this.audit.log({ actorId, entityType: 'Payout', entityId: id, action: `${prefix}_PROCESSING`, diff: { externalReference: outcome.externalReference } });
        // Validé par l'équipe mais pas encore confirmé par le prestataire : le conducteur sait que sa demande avance.
        if (!automatic) {
          const message = payoutMessage('VALIDATED', amountText, masked);
          await this.notifyDriver(wallet.driverId, message.title, message.body);
        }
      }
    } catch (error) {
      // Résultat inconnu : on ne rembourse pas (l'argent est peut-être parti), on ne marque pas payé. L'équipe vérifie.
      this.logger.error(`Retrait ${id} : résultat inconnu après l'appel au prestataire — laissé « en cours » pour vérification.`, (error as Error).stack);
      Sentry.captureException(error);
      await this.audit.log({
        actorId,
        entityType: 'Payout',
        entityId: id,
        action: `${prefix}_ERROR`,
        diff: { message: (error as Error).message },
      });
    }
    return this.findOne(id);
  }

  /**
   * Alerte l'équipe : cloche du back-office ET email, pour qu'un retrait en attente ne passe pas inaperçu (le conducteur attend son
   * argent). Une alerte manquée ne doit jamais faire échouer la demande du conducteur.
   */
  private async alertStaffOfPendingPayout(payoutId: string, amount: bigint, isoCode: string): Promise<void> {
    try {
      await this.notifications.notifyStaff({
        permission: 'payout.manage',
        type: NotificationType.DRIVER_PAYMENT,
        title: 'Retrait à valider',
        body: `Un conducteur demande un retrait de ${formatMoneyWithCurrency(amount, isoCode)}. Vérifie que ton compte Orange Money est approvisionné avant de valider.`,
        link: '/payouts',
        payload: { payoutId },
        email: true,
      });
    } catch (error) {
      this.logger.warn(`Alerte équipe du retrait ${payoutId} non enregistrée : ${(error as Error).message}`);
    }
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

  /** Prévient le conducteur d'une décision de l'équipe (validé, payé, refusé). Ne lève jamais d'exception. */
  private async notifyDriverOfDecision(id: string, kind: PayoutMessageKind, reason?: string): Promise<void> {
    try {
      const payout = await this.findOne(id);
      const wallet = await this.prisma.wallet.findUniqueOrThrow({ where: { id: payout.walletId }, include: { currency: true } });
      const message = payoutMessage(kind, formatMoneyWithCurrency(payout.amount, wallet.currency.isoCode), maskDestination(payout.destinationRef), reason);
      await this.notifyDriver(wallet.driverId, message.title, message.body);
    } catch (error) {
      this.logger.warn(`Notification de décision du retrait ${id} non envoyée : ${(error as Error).message}`);
    }
  }

  /** L'équipe valide la demande : le virement va être (ou est) fait hors prestataire, le conducteur en est prévenu. */
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
    await this.notifyDriverOfDecision(id, 'VALIDATED');
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
    const updated = await this.closeAsPaid(id, actorId);
    await this.notifyDriverOfDecision(id, 'PAID');
    return updated;
  }

  async markFailed(id: string, reason: string, actorId: string) {
    const updated = await this.closeAsFailed(id, reason, actorId);
    await this.notifyDriverOfDecision(id, 'FAILED', reason);
    return updated;
  }
}
