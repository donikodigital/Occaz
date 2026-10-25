// backend/src/payments/payments.service.ts
// [25/10/2026] v3 — settleCancelledBooking / settleCancelledShipment (réutilisés par la reprise automatique RefundRecoveryService) ; paiement tardif : pourcentage noté.
// [21/09/2026] v2 — retenue via Shipment.driverId ; commission déduite une seule fois du montant unique payé (fin du double prélèvement).
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BookingStatus, NotificationChannel, NotificationType, PaymentProviderType, PaymentStatus, Prisma, ShipmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentProvidersService } from '../payment-providers/payment-providers.service';
import { PaymentProviderRegistry } from './providers/payment-provider-registry.service';
import { WalletsService } from '../wallets/wallets.service';
import { BookingsService } from '../trips/bookings.service';
import { ShipmentsService } from '../shipments/shipments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ReferralsService } from '../referrals/referrals.service';
import {
  BookingCancelledEvent,
  DOMAIN_EVENTS,
  ShipmentCancelledEvent,
} from '../common/events/domain-events';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';

/**
 * Règle d'or (section 13) : un paiement n'est jamais considéré réussi
 * parce que l'application mobile le dit — seule la confirmation via
 * webhook, vérifiée par l'adaptateur du prestataire concerné
 * (PaymentProviderRegistry, section 14), fait foi.
 *
 * Ce service orchestre trois briques qui restent chacune indépendantes :
 *   - PaymentProviderRegistry : QUEL prestataire, COMMENT lui parler
 *   - WalletsService : où va l'argent côté conducteur (hold / release)
 *   - BookingsService / ShipmentsService : confirmation du côté métier
 * Les annulations sont gérées par événements (@OnEvent), pas par appel
 * direct depuis Trips/Shipments, pour éviter tout cycle de modules —
 * voir common/events/domain-events.ts.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentProviders: PaymentProvidersService,
    private readonly registry: PaymentProviderRegistry,
    private readonly wallets: WalletsService,
    private readonly bookingsService: BookingsService,
    private readonly shipmentsService: ShipmentsService,
    private readonly notifications: NotificationsService,
    private readonly referrals: ReferralsService,
  ) {}

  // ---------------------------------------------------------------------
  // Initiation
  // ---------------------------------------------------------------------

  async initiate(requester: { customerId: string }, dto: InitiatePaymentDto) {
    if ((!dto.bookingId && !dto.shipmentId) || (dto.bookingId && dto.shipmentId)) {
      throw new BadRequestException('Fournissez exactement un des deux : bookingId ou shipmentId.');
    }

    const providerRow = await this.paymentProviders.findOne(dto.providerId);
    if (!providerRow.isActive) {
      throw new BadRequestException("Ce moyen de paiement n'est plus disponible.");
    }

    let payment = await this.prisma.payment.findUnique({
      where: dto.bookingId ? { bookingId: dto.bookingId } : { shipmentId: dto.shipmentId },
    });
    if (payment && payment.status === PaymentStatus.CAPTURED) {
      throw new ConflictException('Ce paiement a déjà été effectué.');
    }
    if (!payment) {
      const { amount, currencyId } = await this.resolveAmountAndOwnership(requester, dto);
      payment = await this.prisma.payment.create({
        data: {
          bookingId: dto.bookingId,
          shipmentId: dto.shipmentId,
          amount,
          currencyId,
          status: PaymentStatus.PENDING,
        },
      });
    } else {
      await this.assertOwnership(requester, payment);
    }

    const currency = await this.prisma.currency.findUniqueOrThrow({
      where: { id: payment.currencyId },
    });
    const transaction = await this.prisma.paymentTransaction.create({
      data: {
        paymentId: payment.id,
        providerId: providerRow.id,
        amount: payment.amount,
        currencyId: payment.currencyId,
        status: PaymentStatus.PENDING,
      },
    });
    const adapter = this.registry.resolve(providerRow.type);
    const result = await adapter.initiate({
      paymentId: payment.id,
      amount: payment.amount,
      currencyIsoCode: currency.isoCode,
    });

    await this.prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: { externalReference: result.externalReference },
    });

    if (result.immediateStatus) {
      await this.settleTransaction(providerRow.type, result.externalReference, result.immediateStatus, undefined);
    }

    return {
      paymentId: payment.id,
      transactionId: transaction.id,
      externalReference: result.externalReference,
      amount: payment.amount,
      currencyId: payment.currencyId,
      providerType: providerRow.type,
      redirectUrl: result.redirectUrl,
      instructions: result.instructions,
    };
  }

  private async resolveAmountAndOwnership(
    requester: { customerId: string },
    dto: InitiatePaymentDto,
  ): Promise<{ amount: bigint; currencyId: string }> {
    if (dto.bookingId) {
      const booking = await this.prisma.booking.findUnique({ where: { id: dto.bookingId } });
      if (!booking) throw new NotFoundException('Réservation introuvable.');
      if (booking.customerId !== requester.customerId) {
        throw new ForbiddenException('Cette réservation ne vous appartient pas.');
      }
      return { amount: booking.totalAmount, currencyId: booking.currencyId };
    }
    const shipment = await this.prisma.shipment.findUnique({ where: { id: dto.shipmentId } });
    if (!shipment) throw new NotFoundException('Envoi introuvable.');
    if (shipment.customerId !== requester.customerId) {
      throw new ForbiddenException('Cet envoi ne vous appartient pas.');
    }
    return { amount: shipment.totalAmount, currencyId: shipment.currencyId };
  }

  private async assertOwnership(
    requester: { customerId: string },
    payment: { bookingId: string | null; shipmentId: string | null },
  ): Promise<void> {
    const isOwner = await this.isOwnedByCustomer(payment, requester.customerId);
    if (!isOwner) {
      throw new ForbiddenException("Ce paiement ne vous appartient pas.");
    }
  }

  async isOwnedByCustomer(
    payment: { bookingId: string | null; shipmentId: string | null },
    customerId: string,
  ): Promise<boolean> {
    if (payment.bookingId) {
      const booking = await this.prisma.booking.findUnique({ where: { id: payment.bookingId } });
      return booking?.customerId === customerId;
    }
    if (payment.shipmentId) {
      const shipment = await this.prisma.shipment.findUnique({ where: { id: payment.shipmentId } });
      return shipment?.customerId === customerId;
    }
    return false;
  }

  // ---------------------------------------------------------------------
  // Webhook — seule source de vérité pour une capture réussie
  // ---------------------------------------------------------------------

  async handleWebhook(
    providerType: PaymentProviderType,
    rawPayload: unknown,
    headers: Record<string, string>,
  ) {
    const adapter = this.registry.resolve(providerType);
    // Lève une exception si la signature/le secret propre au prestataire
    // ne correspond pas — voir chaque adaptateur pour le détail.
    const parsed = await adapter.verifyAndParseWebhook(rawPayload, headers);
    return this.settleTransaction(providerType, parsed.externalReference, parsed.status, rawPayload);
  }

  /**
   * Règle un paiement à la réception d'une réponse du prestataire (webhook ou réponse immédiate).
   *
   * Sûr face aux envois en double et aux retries du prestataire : on « réclame » le passage à CAPTURED par une mise à
   * jour conditionnelle (un seul appel gagne, les autres sortent sans rien refaire), et un échec ne peut jamais
   * écraser un paiement déjà capturé par une autre tentative. Si le traitement métier échoue, la transaction repasse
   * en attente pour que le renvoi du webhook le reprenne (toutes ses étapes sont rejouables).
   */
  private async settleTransaction(
    providerType: PaymentProviderType,
    externalReference: string,
    status: 'CAPTURED' | 'FAILED',
    rawPayload: unknown,
  ) {
    void providerType;
    const transaction = await this.prisma.paymentTransaction.findFirst({
      where: { externalReference },
    });
    if (!transaction) throw new NotFoundException('Transaction introuvable.');

    if (transaction.status === PaymentStatus.CAPTURED) {
      // Webhook rejoué : idempotent, on ne retraite pas une seconde fois.
      return { paymentId: transaction.paymentId, status: transaction.status };
    }

    const received = { webhookReceivedAt: new Date(), rawPayload: rawPayload as never };

    if (status === 'FAILED') {
      await this.prisma.paymentTransaction.updateMany({
        where: { id: transaction.id, status: { not: PaymentStatus.CAPTURED } },
        data: { status: PaymentStatus.FAILED, ...received },
      });
      await this.prisma.payment.updateMany({
        where: {
          id: transaction.paymentId,
          status: { notIn: [PaymentStatus.CAPTURED, PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED] },
        },
        data: { status: PaymentStatus.FAILED },
      });
      const current = await this.prisma.payment.findUniqueOrThrow({ where: { id: transaction.paymentId } });
      return { paymentId: current.id, status: current.status };
    }

    const claimedTransaction = await this.prisma.paymentTransaction.updateMany({
      where: { id: transaction.id, status: { not: PaymentStatus.CAPTURED } },
      data: { status: PaymentStatus.CAPTURED, ...received },
    });
    if (claimedTransaction.count === 0) {
      return { paymentId: transaction.paymentId, status: PaymentStatus.CAPTURED };
    }

    const claimedPayment = await this.prisma.payment.updateMany({
      where: {
        id: transaction.paymentId,
        status: { notIn: [PaymentStatus.CAPTURED, PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED] },
      },
      data: { status: PaymentStatus.CAPTURED },
    });
    if (claimedPayment.count === 0) {
      // Une autre tentative a déjà capturé ce paiement : le client a été débité deux fois chez le prestataire.
      // On ne recrédite surtout pas le conducteur une seconde fois.
      this.logger.error(
        `Double capture sur le paiement ${transaction.paymentId} (transaction ${transaction.id}, réf. ${externalReference}) — le client a été débité deux fois : remboursement manuel à prévoir.`,
      );
      return { paymentId: transaction.paymentId, status: PaymentStatus.CAPTURED };
    }

    const payment = await this.prisma.payment.findUniqueOrThrow({ where: { id: transaction.paymentId } });
    try {
      await this.handleCaptured(payment);
    } catch (error) {
      await this.prisma.paymentTransaction
        .update({ where: { id: transaction.id }, data: { status: PaymentStatus.PENDING } })
        .catch(() => undefined);
      await this.prisma.payment
        .update({ where: { id: payment.id }, data: { status: PaymentStatus.PENDING } })
        .catch(() => undefined);
      throw error;
    }

    return { paymentId: payment.id, status: PaymentStatus.CAPTURED };
  }

  private async handleCaptured(payment: {
    id: string;
    bookingId: string | null;
    shipmentId: string | null;
  }): Promise<void> {
    if (payment.bookingId) {
      const booking = await this.prisma.booking.findUniqueOrThrow({
        where: { id: payment.bookingId },
        include: {
          trip: { include: { driver: true, originCity: true, destinationCity: true } },
          customer: true,
          boardingStop: { include: { city: true } },
          alightingStop: { include: { city: true } },
        },
      });
      const outcome = await this.bookingsService.confirmPayment(booking.id);
      if (outcome === 'NOT_PAYABLE') {
        // Paiement arrivé après l'annulation / l'expiration de la réservation (mobile money asynchrone) : la place
        // n'est plus réservée. On rembourse intégralement le client et on ne crédite pas le conducteur.
        this.logger.warn(`Paiement reçu pour la réservation ${booking.id} déjà annulée — remboursement intégral.`);
        // On note la décision (100 %) pour que la reprise automatique finisse le travail si le prestataire échoue maintenant.
        await this.prisma.booking.updateMany({ where: { id: booking.id, status: BookingStatus.CANCELLED }, data: { refundPercentage: 100 } });
        await this.refundBooking(booking.id, 100);
        return;
      }
      await this.wallets.holdBookingRevenue({
        driverId: booking.trip.driverId,
        bookingId: booking.id,
        // Même formule que pour les envois : le client paie un seul montant (totalAmount), la commission de la
        // plateforme (platformFee) en est retirée, le reste revient au conducteur — soit exactement le prix qu'il a
        // fixé (pricePerSeat × places), quel que soit le code promo : un rabais ne réduit que platformFee, donc
        // totalAmount baisse du même montant et le net du conducteur ne bouge pas (ex. 115 000 payés − 15 000 = 100 000 ;
        // avec 10 000 de rabais : 105 000 − 5 000 = 100 000).
        grossAmount: booking.totalAmount as bigint,
        commission: booking.platformFee,
        // Devise dans laquelle le client a payé — Booking.currencyId,
        // déjà disponible sans requête supplémentaire. Peut différer de
        // la devise du portefeuille du conducteur (trajet transfrontalier)
        // ; WalletsService.holdBookingRevenue convertit si besoin.
        sourceCurrencyId: booking.currencyId,
      });
      await this.notifications.notify({
        userId: booking.customer.userId,
        type: NotificationType.PAYMENT,
        channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL],
        fallbackTitle: 'Paiement confirmé',
        fallbackBody: 'Votre paiement a été confirmé — votre réservation est validée.',
      });
      await this.notifications.notify({
        userId: booking.trip.driver.userId,
        type: NotificationType.BOOKING,
        channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL],
        fallbackTitle: 'Nouvelle réservation',
        fallbackBody: `${booking.seatsCount} place${booking.seatsCount > 1 ? 's' : ''} réservée${booking.seatsCount > 1 ? 's' : ''} sur votre trajet ${booking.boardingStop?.city?.name ?? booking.trip.originCity.name} → ${booking.alightingStop?.city?.name ?? booking.trip.destinationCity.name}.`,
        pushData: { type: 'BOOKING', tripId: booking.trip.id, bookingId: booking.id },
      });
      await this.notifyReferralOfFirstPayment(booking.customer.userId);
    }

    if (payment.shipmentId) {
      const shipment = await this.prisma.shipment.findUniqueOrThrow({
        where: { id: payment.shipmentId },
        include: { customer: true },
      });
      if (shipment.status === ShipmentStatus.CANCELLED || shipment.status === ShipmentStatus.REFUNDED) {
        // Même cas pour un envoi : paiement tardif sur une demande déjà annulée → remboursement intégral.
        this.logger.warn(`Paiement reçu pour l'envoi ${shipment.id} déjà annulé — remboursement intégral.`);
        await this.refundShipment(shipment.id, 100);
        return;
      }
      await this.shipmentsService.confirmPayment(shipment.id);
      if (shipment.driverId) {
        // Un conducteur était déjà choisi avant le paiement : on peut
        // provisionner tout de suite. Sinon (SEARCHING_DRIVER), le hold
        // est différé jusqu'à ShipmentsService.accept. Le client a payé un
        // montant unique (totalAmount) ; la commission en est déduite du gain
        // du conducteur, une seule fois.
        await this.wallets.holdShipmentRevenue({
          driverId: shipment.driverId,
          shipmentId: shipment.id,
          grossAmount: shipment.totalAmount,
          commission: shipment.platformFee,
          sourceCurrencyId: shipment.currencyId,
        });
      }
      await this.notifications.notify({
        userId: shipment.customer.userId,
        type: NotificationType.PAYMENT,
        channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL],
        fallbackTitle: 'Paiement confirmé',
        fallbackBody: 'Votre paiement a été confirmé — nous recherchons un conducteur pour votre envoi.',
      });
      await this.notifyReferralOfFirstPayment(shipment.customer.userId);
    }
  }

  /**
   * Ne doit jamais faire échouer une confirmation de paiement — un souci
   * côté parrainage (filleul introuvable, réglage manquant...) reste
   * isolé ici, journalé, sans remonter à l'appelant.
   */
  private async notifyReferralOfFirstPayment(customerUserId: string): Promise<void> {
    try {
      await this.referrals.handleFirstPaymentConfirmed(customerUserId);
    } catch (error) {
      this.logger.error(`Échec de la détection de parrainage pour l'utilisateur ${customerUserId}`, error as Error);
    }
  }

  // ---------------------------------------------------------------------
  // Annulation -> remboursement (réaction aux événements de domaine)
  // ---------------------------------------------------------------------

  @OnEvent(DOMAIN_EVENTS.BOOKING_CANCELLED)
  async handleBookingCancelled(event: BookingCancelledEvent): Promise<void> {
    try {
      await this.settleCancelledBooking(event.bookingId, event.refundEligiblePercentage ?? 0, event.reason);
    } catch (error) {
      // Une réservation annulée ne doit jamais rester bloquée parce que le remboursement a échoué : l'erreur est journalisée et
      // RefundRecoveryService reprend l'opération quelques minutes plus tard (puis alerte le support si elle persiste).
      this.logger.error(`Échec du remboursement pour la réservation ${event.bookingId}`, error as Error);
    }
  }

  /**
   * Suites financières d'une réservation annulée : remboursement du client, puis sort des fonds du conducteur. Chaque étape est
   * rejouable sans danger (remboursement plafonné et réclamé en base, libération des fonds seulement sur les lignes encore en attente).
   * `skipRefund` : la reprise automatique ne rembourse pas une seconde fois un paiement déjà (partiellement) remboursé, elle termine
   * seulement le sort des fonds du conducteur.
   * Lève l'erreur si une étape échoue.
   */
  async settleCancelledBooking(
    bookingId: string,
    percentage: number,
    reason: string,
    options: { skipRefund?: boolean } = {},
  ): Promise<void> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { trip: true },
    });
    if (!booking) return;

    if (!options.skipRefund) await this.refundBooking(bookingId, percentage);
    if (percentage >= 100) {
      // Remboursement intégral : le conducteur ne touche rien (idempotent, refundBooking l'a déjà fait dans la plupart des cas).
      await this.wallets.reverseHeldFunds({ driverId: booking.trip.driverId, bookingId, reason });
    } else {
      // Annulation tardive du client (remboursement partiel ou nul) : comme sur BlaBlaCar, le conducteur qui avait réservé sa
      // place garde la part non remboursée. La part rendue au client a déjà été retirée de ses fonds (refundBooking) ; le reste
      // est libéré dans son solde disponible. Sans paiement capturé, il n'y a rien en attente et rien n'est versé.
      await this.wallets.releaseHeldFunds({ driverId: booking.trip.driverId, bookingId });
    }
  }

  @OnEvent(DOMAIN_EVENTS.SHIPMENT_CANCELLED)
  async handleShipmentCancelled(event: ShipmentCancelledEvent): Promise<void> {
    try {
      await this.settleCancelledShipment(event.shipmentId, event.refundEligiblePercentage ?? 0, event.reason);
    } catch (error) {
      this.logger.error(`Échec du remboursement pour l'envoi ${event.shipmentId}`, error as Error);
    }
  }

  /** Équivalent de settleCancelledBooking pour un envoi annulé (voir ce commentaire). Lève l'erreur si une étape échoue. */
  async settleCancelledShipment(
    shipmentId: string,
    percentage: number,
    reason: string,
    options: { skipRefund?: boolean } = {},
  ): Promise<void> {
    const shipment = await this.prisma.shipment.findUnique({ where: { id: shipmentId } });
    if (!shipment) return;

    if (!options.skipRefund) await this.refundShipment(shipmentId, percentage);
    if (shipment.driverId) {
      await this.wallets.reverseHeldFunds({ driverId: shipment.driverId, shipmentId, reason });
    }
  }

  /**
   * Rembourse tout ou partie d'une réservation payée. `refundPercentage` est un pourcentage du montant payé ; `options.amount` (plus petite
   * unité de la devise) l'emporte quand on connaît le montant exact (litige). Renvoie le montant réellement rendu (0 si rien n'a été remboursé) :
   * un remboursement déjà fait, un paiement non capturé ou un montant nul ne déclenchent ni notification ni changement de statut.
   * Sûr face aux appels simultanés (double appui, annulation du client et du conducteur en même temps) : voir executeRefund.
   */
  async refundBooking(bookingId: string, refundPercentage: number, options: { amount?: bigint } = {}): Promise<bigint> {
    if (options.amount === undefined && Math.round(refundPercentage) <= 0) return 0n;
    const payment = await this.prisma.payment.findUnique({ where: { bookingId } });
    if (!payment) return 0n;
    const outcome = await this.executeRefund(payment, { percentage: refundPercentage, amount: options.amount });
    if (!outcome) return 0n;

    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: { customer: true, trip: { select: { driverId: true } } },
    });
    if (outcome.isFull) {
      // Une réservation annulée reste « annulée » (sa place est rendue) ; seule une réservation encore en cours passe à « remboursée ».
      await this.prisma.booking.updateMany({
        where: { id: bookingId, status: { notIn: [BookingStatus.CANCELLED, BookingStatus.REFUNDED] } },
        data: { status: BookingStatus.REFUNDED },
      });
      // Client remboursé en totalité : le conducteur ne doit plus toucher cette course (si ses fonds sont encore en
      // attente). S'ils sont déjà libérés, c'est au support de les ajuster (wallet.adjust) — on le signale.
      await this.wallets.reverseHeldFunds({
        driverId: booking.trip.driverId,
        bookingId,
        reason: 'Remboursement intégral du client',
      });
      await this.warnIfFundsAlreadyReleased({ bookingId }, 'réservation');
    } else {
      // Remboursement partiel : le conducteur supporte sa part (au prorata) sur les fonds encore en attente.
      const deducted = await this.wallets.deductHeldFunds({
        driverId: booking.trip.driverId,
        bookingId,
        refundedAmount: outcome.refundAmount,
        paidAmount: payment.amount,
        reason: 'Remboursement partiel du client',
      });
      if (!deducted) {
        this.logger.warn(`Remboursement partiel de la réservation ${bookingId} alors que les gains du conducteur sont déjà libérés — ajustement manuel à prévoir (wallet.adjust).`);
      }
    }
    await this.notifyRefund(booking.customer.userId, outcome.refundAmount, payment.amount);
    return outcome.refundAmount;
  }

  async refundShipment(shipmentId: string, refundPercentage: number, options: { amount?: bigint } = {}): Promise<bigint> {
    if (options.amount === undefined && Math.round(refundPercentage) <= 0) return 0n;
    const payment = await this.prisma.payment.findUnique({ where: { shipmentId } });
    if (!payment) return 0n;
    const outcome = await this.executeRefund(payment, { percentage: refundPercentage, amount: options.amount });
    if (!outcome) return 0n;

    // Le statut REFUNDED du Shipment est déjà posé par
    // ShipmentsService.cancel (CANCELLED) — un envoi remboursé après
    // annulation reste CANCELLED, section 20 ne prévoit pas de double
    // statut ; seul Payment.status distingue "remboursé" de "non remboursé".
    const shipment = await this.prisma.shipment.findUniqueOrThrow({
      where: { id: shipmentId },
      include: { customer: true },
    });
    if (outcome.isFull && shipment.driverId) {
      await this.wallets.reverseHeldFunds({
        driverId: shipment.driverId,
        shipmentId,
        reason: 'Remboursement intégral du client',
      });
      await this.warnIfFundsAlreadyReleased({ shipmentId }, 'envoi');
    } else if (shipment.driverId) {
      const deducted = await this.wallets.deductHeldFunds({
        driverId: shipment.driverId,
        shipmentId,
        refundedAmount: outcome.refundAmount,
        paidAmount: payment.amount,
        reason: 'Remboursement partiel du client',
      });
      if (!deducted) {
        this.logger.warn(`Remboursement partiel de l'envoi ${shipmentId} alors que les gains du conducteur sont déjà libérés — ajustement manuel à prévoir (wallet.adjust).`);
      }
    }
    await this.notifyRefund(shipment.customer.userId, outcome.refundAmount, payment.amount);
    return outcome.refundAmount;
  }

  private async notifyRefund(userId: string, refundAmount: bigint, paidAmount: bigint): Promise<void> {
    const percentage = paidAmount > 0n ? Math.round((Number(refundAmount) * 100) / Number(paidAmount)) : 0;
    await this.notifications.notify({
      userId,
      type: NotificationType.REFUND,
      channels: [NotificationChannel.PUSH, NotificationChannel.SMS, NotificationChannel.EMAIL],
      fallbackTitle: 'Remboursement effectué',
      fallbackBody: `Votre remboursement (${percentage}%) a été traité.`,
      pushData: { type: 'REFUND' },
    });
  }

  /** Signale au support un remboursement intégral dont l'argent est déjà dans le solde disponible du conducteur. */
  private async warnIfFundsAlreadyReleased(
    reference: { bookingId: string } | { shipmentId: string },
    label: string,
  ): Promise<void> {
    const released = await this.prisma.walletTransaction.count({
      where: {
        ...reference,
        status: 'COMPLETED',
        type: { in: ['BOOKING_REVENUE', 'SHIPMENT_REVENUE'] },
      },
    });
    if (released > 0) {
      this.logger.warn(
        `Remboursement intégral d'une ${label} dont les gains du conducteur sont déjà libérés (${JSON.stringify(reference)}) — ajustement manuel du portefeuille à prévoir (wallet.adjust).`,
      );
    }
  }

  /**
   * Rembourse chez le prestataire, UNE seule fois pour un même montant, même si l'appel arrive plusieurs fois en même temps.
   *
   *  1. On « réclame » le remboursement par une mise à jour conditionnelle du paiement (même statut ET même date de dernière
   *     modification que ce qu'on a lu) et on inscrit la ligne de remboursement dans la MÊME transaction : un second appel simultané
   *     ne trouve plus ce qu'il a lu et sort sans rien envoyer au prestataire.
   *  2. Le montant est plafonné à ce qui reste à rembourser (les remboursements s'additionnent : 50 % puis 50 % = 100 %, jamais plus).
   *  3. Si le prestataire échoue, la réclamation est annulée (ligne supprimée, statut remis) et l'erreur remonte.
   * Renvoie null quand il n'y avait rien à faire.
   */
  private async executeRefund(
    payment: { id: string; amount: bigint; currencyId: string; status: PaymentStatus; updatedAt: Date },
    request: { percentage?: number; amount?: bigint },
  ): Promise<{ refundAmount: bigint; isFull: boolean } | null> {
    if (payment.status !== PaymentStatus.CAPTURED && payment.status !== PaymentStatus.PARTIALLY_REFUNDED) return null;

    const refunded = await this.prisma.paymentTransaction.aggregate({
      where: { paymentId: payment.id, status: PaymentStatus.REFUNDED },
      _sum: { amount: true },
    });
    const already = refunded._sum?.amount ?? 0n;
    const remaining = payment.amount - already;
    if (remaining <= 0n) return null;

    const percentage = Math.max(0, Math.min(100, request.percentage ?? 0));
    const wanted = request.amount ?? BigInt(Math.round(Number(payment.amount) * (percentage / 100)));
    if (wanted <= 0n) return null;
    const refundAmount = wanted > remaining ? remaining : wanted;
    const isFull = already + refundAmount >= payment.amount;

    const capturedTransaction = await this.prisma.paymentTransaction.findFirst({
      where: { paymentId: payment.id, status: PaymentStatus.CAPTURED },
      orderBy: { createdAt: 'desc' },
      include: { provider: true },
    });
    if (!capturedTransaction) return null;

    const refundRow = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const claimed = await tx.payment.updateMany({
        where: { id: payment.id, status: payment.status, updatedAt: payment.updatedAt },
        data: { status: isFull ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED },
      });
      if (claimed.count === 0) return null;
      return tx.paymentTransaction.create({
        data: {
          paymentId: payment.id,
          providerId: capturedTransaction.providerId,
          amount: refundAmount,
          currencyId: payment.currencyId,
          status: PaymentStatus.REFUNDED,
        },
      });
    });
    if (!refundRow) return null;

    try {
      const adapter = this.registry.resolve(capturedTransaction.provider.type);
      const refundResult = await adapter.refund({
        externalReference: capturedTransaction.externalReference!,
        amount: refundAmount,
      });
      await this.prisma.paymentTransaction.update({
        where: { id: refundRow.id },
        data: { externalReference: refundResult.externalReference },
      });
    } catch (error) {
      await this.prisma.$transaction([
        this.prisma.paymentTransaction.delete({ where: { id: refundRow.id } }),
        this.prisma.payment.updateMany({ where: { id: payment.id }, data: { status: payment.status } }),
      ]).catch((rollbackError) => this.logger.error(`Remboursement du paiement ${payment.id} : annulation de la réclamation impossible`, rollbackError as Error));
      throw error;
    }
    return { refundAmount, isFull };
  }

  // ---------------------------------------------------------------------

  async findOne(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { transactions: true },
    });
    if (!payment) throw new NotFoundException('Paiement introuvable.');
    return payment;
  }
}