// backend/src/wallets/wallets.service.ts
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  DisputeStatus,
  NotificationChannel,
  NotificationType,
  Prisma,
  WalletTransactionStatus,
  WalletTransactionType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ExchangeRateService } from '../pricing/exchange-rate.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/dto/pagination-response.dto';
import { WalletTransactionsQueryDto } from './dto/wallet-transactions-query.dto';
import {
  WALLET_TX_FILTERS,
  filterByCategory,
  mergeForDriver,
  summarize,
  type DriverHistoryRow,
  type LedgerRow,
} from './wallet-history';
import { toMoneyBigInt, formatMoneyWithCurrency } from '../common/utils/money.util';

type BalanceField = 'balance' | 'pendingBalance';

/** Nombre maximal de lignes lues pour l'historique conducteur (garde-fou mémoire ; un conducteur normal en a quelques centaines). */
const DRIVER_VIEW_MAX_ROWS = 10_000;

@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly exchangeRates: ExchangeRateService,
  ) {}

  async findByDriverId(driverId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { driverId },
      include: { currency: true },
    });
    if (!wallet) throw new NotFoundException('Portefeuille introuvable.');
    return wallet;
  }

  async findOne(id: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id },
      include: { currency: true },
    });
    if (!wallet) throw new NotFoundException('Portefeuille introuvable.');
    return wallet;
  }

  async getTransactions(
    walletId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<unknown>> {
    const where = { walletId };
    const [data, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.walletTransaction.count({ where }),
    ]);
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  /**
   * Vue « conducteur » de son propre historique — jamais le montant brut payé par le client ni la commission plateforme comme
   * lignes séparées (demande explicite : le conducteur ne voit que sa part). La fusion revenu + commission en une ligne au net, le
   * classement par catégorie et les totaux sont dans wallet-history.ts. N'affecte que cette vue : le registre comptable réel
   * (getTransactions, utilisé aussi par l'admin) n'est pas modifié.
   *
   * Réponse : la page demandée (filtrée par `category`, lignes enrichies de l'itinéraire / du statut du retrait), et `summary` —
   * les totaux de TOUTES les catégories sur tout l'historique, pour que l'écran affiche le total de chaque filtre sans tout charger.
   */
  async getTransactionsForDriverView(walletId: string, query: WalletTransactionsQueryDto) {
    // Seules les colonnes utiles à l'affichage sont lues (pas de références externes ni d'identifiants d'auteur), et la lecture est
    // plafonnée : l'historique n'est plus chargé sans limite en mémoire à chaque ouverture de l'écran.
    const rows = await this.prisma.walletTransaction.findMany({
      where: { walletId },
      orderBy: { createdAt: 'desc' },
      take: DRIVER_VIEW_MAX_ROWS,
      select: {
        id: true,
        type: true,
        status: true,
        amount: true,
        currencyId: true,
        bookingId: true,
        shipmentId: true,
        payoutId: true,
        createdAt: true,
        metadata: true,
      },
    });
    if (rows.length >= DRIVER_VIEW_MAX_ROWS) {
      this.logger.warn(`Historique du portefeuille ${walletId} tronqué à ${DRIVER_VIEW_MAX_ROWS} lignes — prévoir une pagination SQL.`);
    }

    const history = mergeForDriver(rows as LedgerRow[]);
    const filtered = filterByCategory(history, query.category ?? 'ALL');
    const pageRows = filtered.slice(query.skip, query.skip + query.take);
    const data = await this.attachSubjects(pageRows);

    const summary = summarize(history);
    const serialized = Object.fromEntries(
      WALLET_TX_FILTERS.map((key) => [
        key,
        { count: summary[key].count, total: summary[key].total.toString(), pending: summary[key].pending.toString() },
      ]),
    );
    return { ...new PaginatedResult(data, filtered.length, query.page, query.limit), summary: serialized };
  }

  /**
   * Ajoute à chaque ligne de quoi la reconnaître : l'itinéraire du trajet (« Mamou → Dalaba ») ou de l'envoi, le statut et le mode de
   * paiement d'un retrait. Villes seulement : jamais le nom ni le numéro du client.
   */
  private async attachSubjects(rows: DriverHistoryRow[]) {
    const bookingIds = [...new Set(rows.map((r) => r.bookingId).filter((id): id is string => Boolean(id)))];
    const shipmentIds = [...new Set(rows.map((r) => r.shipmentId).filter((id): id is string => Boolean(id)))];
    const payoutIds = [...new Set(rows.map((r) => r.payoutId).filter((id): id is string => Boolean(id)))];

    const [bookings, shipments, payouts] = await Promise.all([
      bookingIds.length
        ? this.prisma.booking.findMany({
            where: { id: { in: bookingIds } },
            select: {
              id: true,
              seatsCount: true,
              boardingStop: { select: { city: { select: { name: true } } } },
              alightingStop: { select: { city: { select: { name: true } } } },
              trip: { select: { originCity: { select: { name: true } }, destinationCity: { select: { name: true } } } },
            },
          })
        : [],
      shipmentIds.length
        ? this.prisma.shipment.findMany({
            where: { id: { in: shipmentIds } },
            select: {
              id: true,
              weightKg: true,
              category: { select: { name: true } },
              senderLocation: { select: { label: true, city: { select: { name: true } } } },
              recipientLocation: { select: { label: true, city: { select: { name: true } } } },
            },
          })
        : [],
      payoutIds.length
        ? this.prisma.payout.findMany({
            where: { id: { in: payoutIds } },
            select: { id: true, status: true, method: true, destinationRef: true, requestedAt: true },
          })
        : [],
    ]);

    const bookingById = new Map(bookings.map((b) => [b.id, b]));
    const shipmentById = new Map(shipments.map((s) => [s.id, s]));
    const payoutById = new Map(payouts.map((p) => [p.id, p]));

    return rows.map((row) => {
      const booking = row.bookingId ? bookingById.get(row.bookingId) : undefined;
      const shipment = row.shipmentId ? shipmentById.get(row.shipmentId) : undefined;
      const payout = row.payoutId ? payoutById.get(row.payoutId) : undefined;

      const subject = booking
        ? {
            kind: 'TRIP' as const,
            // Le tronçon du client (« Dalaba → Pita »), pas le trajet entier du conducteur.
            from: booking.boardingStop?.city?.name ?? booking.trip.originCity.name,
            to: booking.alightingStop?.city?.name ?? booking.trip.destinationCity.name,
            seats: booking.seatsCount,
          }
        : shipment
          ? {
              kind: 'SHIPMENT' as const,
              from: shipment.senderLocation.city?.name ?? shipment.senderLocation.label,
              to: shipment.recipientLocation.city?.name ?? shipment.recipientLocation.label,
              weightKg: shipment.weightKg,
              categoryName: shipment.category?.name ?? null,
            }
          : payout
            ? { kind: 'PAYOUT' as const, status: payout.status, method: payout.method, destination: payout.destinationRef }
            : null;

      return { ...row, subject };
    });
  }

  private async applyDelta(
    walletId: string,
    field: BalanceField,
    delta: bigint,
    entry: {
      type: WalletTransactionType;
      status?: WalletTransactionStatus;
      bookingId?: string;
      shipmentId?: string;
      payoutId?: string;
      externalReference?: string;
      paymentReference?: string;
      metadata?: Prisma.InputJsonValue;
      triggeredByUserId?: string;
    },
    /** Transaction englobante : permet d'enchaîner plusieurs écritures de façon atomique (tout ou rien). */
    client?: Prisma.TransactionClient,
  ) {
    const run = async (tx: Prisma.TransactionClient) => {
      // Incrément atomique côté base : deux crédits simultanés s'additionnent au lieu de se bloquer l'un l'autre
      // (l'ancien verrou de version levait un conflit — fatal quand le crédit suivait une confirmation de paiement).
      const wallet = await tx.wallet.update({
        where: { id: walletId },
        data: { [field]: { increment: delta }, version: { increment: 1 } },
      });

      return tx.walletTransaction.create({
        data: {
          walletId,
          type: entry.type,
          status: entry.status ?? WalletTransactionStatus.COMPLETED,
          amount: delta,
          currencyId: wallet.currencyId,
          bookingId: entry.bookingId,
          shipmentId: entry.shipmentId,
          payoutId: entry.payoutId,
          externalReference: entry.externalReference,
          paymentReference: entry.paymentReference,
          metadata: entry.metadata,
          triggeredByUserId: entry.triggeredByUserId,
        },
      });
    };
    return client ? run(client) : this.prisma.$transaction(run);
  }

  /**
   * `sourceCurrencyId` : devise dans laquelle grossAmount/commission sont
   * exprimés (celle du Booking/Payment) — peut différer de la devise du
   * portefeuille du conducteur (ex : trajet transfrontalier payé en XOF,
   * conducteur inscrit en Guinée avec un wallet en GNF). Convertie ici
   * avant tout crédit ; voir ExchangeRateService pour le détail. Cas le
   * plus fréquent (même devise) : aucun appel supplémentaire, aucun
   * changement de comportement.
   */
  async holdBookingRevenue(params: {
    driverId: string;
    bookingId: string;
    grossAmount: bigint;
    commission: bigint;
    sourceCurrencyId: string;
  }, client?: Prisma.TransactionClient) {
    await this.holdRevenue({
      driverId: params.driverId,
      grossAmount: params.grossAmount,
      commission: params.commission,
      sourceCurrencyId: params.sourceCurrencyId,
      revenueType: WalletTransactionType.BOOKING_REVENUE,
      reference: { bookingId: params.bookingId },
    }, client);
  }

  /** `client` : transaction englobante — la mise en attente est alors annulée avec le reste si celle-ci échoue (voir ShipmentsService.accept). */
  async holdShipmentRevenue(params: {
    driverId: string;
    shipmentId: string;
    grossAmount: bigint;
    commission: bigint;
    sourceCurrencyId: string;
  }, client?: Prisma.TransactionClient) {
    await this.holdRevenue({
      driverId: params.driverId,
      grossAmount: params.grossAmount,
      commission: params.commission,
      sourceCurrencyId: params.sourceCurrencyId,
      revenueType: WalletTransactionType.SHIPMENT_REVENUE,
      reference: { shipmentId: params.shipmentId },
    }, client);
  }

  /**
   * Met en attente le revenu d'une prestation et sa commission, EN UNE SEULE TRANSACTION : l'une ne peut plus être
   * enregistrée sans l'autre (sinon le conducteur serait crédité sans commission). Idempotent : si le revenu de
   * cette prestation est déjà enregistré (webhook rejoué, reprise après erreur), rien n'est compté une seconde fois.
   */
  private async holdRevenue(params: {
    driverId: string;
    grossAmount: bigint;
    commission: bigint;
    sourceCurrencyId: string;
    revenueType: WalletTransactionType;
    reference: { bookingId: string } | { shipmentId: string };
  }, client?: Prisma.TransactionClient) {
    const wallet = await this.findByDriverId(params.driverId);
    const gross = await this.exchangeRates.convert(params.grossAmount, params.sourceCurrencyId, wallet.currencyId);
    const commission = await this.exchangeRates.convert(params.commission, params.sourceCurrencyId, wallet.currencyId);

    const run = async (tx: Prisma.TransactionClient) => {
      // Verrou sur le portefeuille : deux mises en attente simultanées de la même prestation (webhook rejoué en même temps que la
      // reprise) passent l'une après l'autre, et la seconde voit la ligne déjà écrite — jamais de revenu compté deux fois.
      await tx.$queryRaw`SELECT "id" FROM "wallets" WHERE "id" = ${wallet.id} FOR UPDATE`;
      const already = await tx.walletTransaction.findFirst({
        where: { type: params.revenueType, ...params.reference },
        select: { id: true },
      });
      if (already) return;

      await this.applyDelta(
        wallet.id,
        'pendingBalance',
        gross.amount,
        {
          type: params.revenueType,
          status: WalletTransactionStatus.PENDING,
          ...params.reference,
          metadata: gross.conversion ? ({ conversion: gross.conversion } as unknown as Prisma.InputJsonValue) : undefined,
        },
        tx,
      );
      await this.applyDelta(
        wallet.id,
        'pendingBalance',
        -commission.amount,
        {
          type: WalletTransactionType.COMMISSION,
          status: WalletTransactionStatus.PENDING,
          ...params.reference,
          metadata: commission.conversion
            ? ({ conversion: commission.conversion } as unknown as Prisma.InputJsonValue)
            : undefined,
        },
        tx,
      );
    };
    await (client ? run(client) : this.prisma.$transaction(run));
  }

  /** Vrai si un litige encore en cours (sans décision enregistrée) porte sur cette réservation / cet envoi. */
  private async hasOpenDispute(reference: { bookingId?: string; shipmentId?: string }): Promise<boolean> {
    const count = await this.prisma.dispute.count({
      where: {
        ...(reference.bookingId ? { bookingId: reference.bookingId } : { shipmentId: reference.shipmentId }),
        status: { notIn: [DisputeStatus.RESOLVED, DisputeStatus.CLOSED] },
        resolution: { is: null },
      },
    });
    return count > 0;
  }

  /**
   * Opère uniquement sur des WalletTransaction déjà enregistrées (donc
   * déjà dans la devise du wallet, la conversion a eu lieu une seule
   * fois à la mise en attente) — aucune conversion à refaire ici.
   */
  async releaseHeldFunds(params: { driverId: string; bookingId?: string; shipmentId?: string }) {
    if (!params.bookingId && !params.shipmentId) return; // sans référence, le filtre prendrait TOUTES les lignes en attente
    // Litige ouvert : l'argent reste en attente jusqu'à la décision de l'arbitre (le traitement de reprise libère ensuite ce qui doit l'être).
    if (await this.hasOpenDispute(params)) return;
    const wallet = await this.findByDriverId(params.driverId);

    const netAmount = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const pending = await tx.walletTransaction.findMany({
        where: {
          walletId: wallet.id,
          status: WalletTransactionStatus.PENDING,
          bookingId: params.bookingId,
          shipmentId: params.shipmentId,
        },
      });
      if (pending.length === 0) return null;

      // On ne libère que les lignes encore PENDING au moment de l'écriture : si un autre appel vient de les
      // libérer (double validation, reprise), 0 ligne est réclamée et on s'arrête — jamais de double crédit.
      const claimed = await tx.walletTransaction.updateMany({
        where: { id: { in: pending.map((t) => t.id) }, status: WalletTransactionStatus.PENDING },
        data: { status: WalletTransactionStatus.COMPLETED },
      });
      if (claimed.count === 0) return null;
      if (claimed.count !== pending.length) {
        throw new ConflictException('Libération concurrente des fonds, veuillez réessayer.');
      }

      const net: bigint = pending.reduce((sum: bigint, t: { amount: bigint }) => sum + t.amount, 0n);
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          pendingBalance: { decrement: net },
          balance: { increment: net },
          version: { increment: 1 },
        },
      });
      return net;
    });
    if (netAmount === null) return;

    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: params.driverId },
      select: { userId: true },
    });
    if (driver) {
      await this.notifications.notify({
        audience: 'DRIVER',
        userId: driver.userId,
        type: NotificationType.DRIVER_PAYMENT,
        channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL],
        fallbackTitle: 'Paiement reçu',
        // Avec la devise du PORTEFEUILLE (celle du crédit) : sans elle, « 3875 » pouvait aussi bien être du GNF que du XOF.
        fallbackBody: `${formatMoneyWithCurrency(netAmount, wallet.currency.isoCode)} ont été ajoutés à votre solde disponible.`,
      });
    }
  }

  async reverseHeldFunds(params: {
    driverId: string;
    bookingId?: string;
    shipmentId?: string;
    reason: string;
  }) {
    if (!params.bookingId && !params.shipmentId) return;
    const wallet = await this.findByDriverId(params.driverId);

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const pending = await tx.walletTransaction.findMany({
        where: {
          walletId: wallet.id,
          status: WalletTransactionStatus.PENDING,
          bookingId: params.bookingId,
          shipmentId: params.shipmentId,
        },
      });
      if (pending.length === 0) return;

      // Même principe que releaseHeldFunds : on ne réclame que les lignes encore PENDING, dans la même
      // transaction que la mise à jour du solde — pas de solde en attente qui reste gonflé ni de double reprise.
      const claimed = await tx.walletTransaction.updateMany({
        where: { id: { in: pending.map((t) => t.id) }, status: WalletTransactionStatus.PENDING },
        data: { status: WalletTransactionStatus.REVERSED },
      });
      if (claimed.count === 0) return;
      if (claimed.count !== pending.length) {
        throw new ConflictException('Reprise concurrente des fonds, veuillez réessayer.');
      }

      const net: bigint = pending.reduce((sum: bigint, t: { amount: bigint }) => sum + t.amount, 0n);
      await this.applyDelta(
        wallet.id,
        'pendingBalance',
        -net,
        {
          type: WalletTransactionType.REFUND,
          bookingId: params.bookingId,
          shipmentId: params.shipmentId,
          metadata: { reason: params.reason },
        },
        tx,
      );
    });
  }

  /**
   * Remboursement PARTIEL d'un client : la part remboursée est retirée des fonds encore en attente du conducteur, au prorata
   * (rembourser 25 % du prix = retirer 25 % de sa part nette). Une ligne REFUND en attente est ajoutée : à la libération comme à
   * l'annulation, le total des lignes en attente reste juste. Renvoie false si les fonds ne sont plus en attente (déjà libérés) :
   * c'est alors au support de régulariser le solde (adjustBalance).
   */
  async deductHeldFunds(params: {
    driverId: string;
    bookingId?: string;
    shipmentId?: string;
    refundedAmount: bigint;
    paidAmount: bigint;
    reason: string;
  }): Promise<boolean> {
    if (!params.bookingId && !params.shipmentId) return false;
    if (params.refundedAmount <= 0n || params.paidAmount <= 0n) return false;
    const wallet = await this.findByDriverId(params.driverId);

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const pending = await tx.walletTransaction.findMany({
        where: {
          walletId: wallet.id,
          status: WalletTransactionStatus.PENDING,
          bookingId: params.bookingId,
          shipmentId: params.shipmentId,
        },
      });
      if (pending.length === 0) return false;

      const net: bigint = pending.reduce((sum: bigint, t: { amount: bigint }) => sum + t.amount, 0n);
      const ratio = params.refundedAmount > params.paidAmount ? params.paidAmount : params.refundedAmount;
      let deduction = (net * ratio) / params.paidAmount;
      if (deduction > net) deduction = net;
      if (deduction <= 0n) return true;

      await this.applyDelta(
        wallet.id,
        'pendingBalance',
        -deduction,
        {
          type: WalletTransactionType.REFUND,
          status: WalletTransactionStatus.PENDING,
          bookingId: params.bookingId,
          shipmentId: params.shipmentId,
          metadata: { reason: params.reason },
        },
        tx,
      );
      return true;
    });
  }

  /**
   * Ajuste le solde disponible (support). Un débit qui rendrait le solde NÉGATIF est refusé, sauf demande explicite `allowDebt`
   * (dette du conducteur après un remboursement sur des gains déjà retirés) — jamais par une simple faute de frappe.
   */
  async adjustBalance(driverId: string, amountStr: string, reason: string, actorId: string, options: { allowDebt?: boolean } = {}) {
    const wallet = await this.findByDriverId(driverId);
    const amount = toMoneyBigInt(amountStr.replace('-', '')) * (amountStr.startsWith('-') ? -1n : 1n);

    const run = async (tx: Prisma.TransactionClient) => {
      if (amount < 0n && !options.allowDebt) {
        // Débit conditionnel : le solde doit couvrir le montant AU MOMENT de l'écriture (pas seulement à la lecture).
        const debited = await tx.wallet.updateMany({
          where: { id: wallet.id, balance: { gte: -amount } },
          data: { balance: { increment: amount }, version: { increment: 1 } },
        });
        if (debited.count === 0) {
          throw new BadRequestException(
            'Ce débit rendrait le solde disponible négatif. Réduisez le montant, ou confirmez explicitement une dette (allowDebt).',
          );
        }
        return tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: WalletTransactionType.ADJUSTMENT,
            status: WalletTransactionStatus.COMPLETED,
            amount,
            currencyId: wallet.currencyId,
            metadata: { reason },
            triggeredByUserId: actorId,
          },
        });
      }
      return this.applyDelta(
        wallet.id,
        'balance',
        amount,
        { type: WalletTransactionType.ADJUSTMENT, metadata: { reason, ...(amount < 0n ? { allowDebt: true } : {}) }, triggeredByUserId: actorId },
        tx,
      );
    };
    const transaction = await this.prisma.$transaction(run);
    await this.audit.log({
      actorId,
      entityType: 'Wallet',
      entityId: wallet.id,
      action: 'ADJUST',
      diff: { amount: amountStr, reason, ...(options.allowDebt ? { allowDebt: true } : {}) },
    });
    return transaction;
  }

  /**
   * Réserve le montant d'un retrait : il quitte le solde disponible pour aller en « en attente », en UNE écriture conditionnelle
   * (le solde doit couvrir le montant au moment de l'écriture). Plus de verrou de version : un crédit qui arrive pile pendant la
   * demande de retrait (libération de fonds, remboursement) ne la fait plus échouer en « conflit » — chaque écriture est atomique.
   */
  async reserveForPayout(driverId: string, amount: bigint, payoutId: string) {
    const wallet = await this.findByDriverId(driverId);
    if (wallet.balance < amount) {
      throw new BadRequestException('Solde insuffisant pour ce retrait.');
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const result = await tx.wallet.updateMany({
        where: { id: wallet.id, balance: { gte: amount } },
        data: {
          balance: { decrement: amount },
          pendingBalance: { increment: amount },
          version: { increment: 1 },
        },
      });
      if (result.count === 0) {
        throw new BadRequestException('Solde insuffisant pour ce retrait.');
      }
      return tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: WalletTransactionType.PAYOUT,
          status: WalletTransactionStatus.PENDING,
          amount: -amount,
          currencyId: wallet.currencyId,
          payoutId,
        },
      });
    });
  }

  /** Retrait versé : la somme réservée sort définitivement du portefeuille. Idempotent (la ligne n'est « réclamée » qu'une fois). */
  async finalizePayout(driverId: string, amount: bigint, payoutId: string): Promise<void> {
    const wallet = await this.findByDriverId(driverId);
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const claimed = await tx.walletTransaction.updateMany({
        where: { payoutId, status: WalletTransactionStatus.PENDING },
        data: { status: WalletTransactionStatus.COMPLETED },
      });
      if (claimed.count === 0) return; // déjà traité : le solde en attente ne doit pas être débité une seconde fois
      const result = await tx.wallet.updateMany({
        where: { id: wallet.id, pendingBalance: { gte: amount } },
        data: { pendingBalance: { decrement: amount }, version: { increment: 1 } },
      });
      if (result.count === 0) {
        throw new ConflictException('Le solde en attente ne couvre pas ce retrait — vérification manuelle nécessaire.');
      }
    });
  }

  /** Retrait échoué ou annulé : la somme réservée revient dans le solde disponible. Idempotent. */
  async reversePayout(driverId: string, amount: bigint, payoutId: string): Promise<void> {
    const wallet = await this.findByDriverId(driverId);
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const claimed = await tx.walletTransaction.updateMany({
        where: { payoutId, status: WalletTransactionStatus.PENDING },
        data: { status: WalletTransactionStatus.REVERSED },
      });
      if (claimed.count === 0) return;
      const result = await tx.wallet.updateMany({
        where: { id: wallet.id, pendingBalance: { gte: amount } },
        data: {
          pendingBalance: { decrement: amount },
          balance: { increment: amount },
          version: { increment: 1 },
        },
      });
      if (result.count === 0) {
        throw new ConflictException('Le solde en attente ne couvre pas ce retrait — vérification manuelle nécessaire.');
      }
    });
  }
}
