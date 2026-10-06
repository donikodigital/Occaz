// backend/src/payments/payments.service.ts
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
import { BookingStatus, NotificationChannel, NotificationType, PaymentProviderType, PaymentStatus, ShipmentStatus } from '@prisma/client';
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
      const booking = await this.prisma.booking.findUnique({
        where: { id: event.bookingId },
        include: { trip: true },
      });
      if (!booking) return;

      await this.refundBooking(event.bookingId, event.refundEligiblePercentage ?? 0);
      await this.wallets.reverseHeldFunds({
        driverId: booking.trip.driverId,
        bookingId: event.bookingId,
        reason: event.reason,
      });
    } catch (error) {
      // Une réservation annulée ne doit jamais rester bloquée parce que
      // le remboursement a échoué : l'erreur est journalisée pour reprise
      // manuelle (support) plutôt que de remonter dans le flux d'annulation.
      this.logger.error(`Échec du remboursement pour la réservation ${event.bookingId}`, error as Error);
    }
  }

  @OnEvent(DOMAIN_EVENTS.SHIPMENT_CANCELLED)
  async handleShipmentCancelled(event: ShipmentCancelledEvent): Promise<void> {
    try {
      const shipment = await this.prisma.shipment.findUnique({
        where: { id: event.shipmentId },
      });
      if (!shipment) return;

      await this.refundShipment(event.shipmentId, event.refundEligiblePercentage ?? 0);
      if (shipment.driverId) {
        await this.wallets.reverseHeldFunds({
          driverId: shipment.driverId,
          shipmentId: event.shipmentId,
          reason: event.reason,
        });
      }
    } catch (error) {
      this.logger.error(`Échec du remboursement pour l'envoi ${event.shipmentId}`, error as Error);
    }
  }

  async refundBooking(bookingId: string, refundPercentage: number): Promise<void> {
    // 0 % : rien n'est remboursé, donc ni statut « remboursé » ni notification trompeuse.
    if (Math.round(refundPercentage) <= 0) return;
    const payment = await this.prisma.payment.findUnique({ where: { bookingId } });
    if (!payment || payment.status !== PaymentStatus.CAPTURED) return;
    await this.executeRefund(payment, refundPercentage);
    const booking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.REFUNDED },
      include: { customer: true, trip: { select: { driverId: true } } },
    });
    if (refundPercentage >= 100) {
      // Client remboursé en totalité : le conducteur ne doit plus toucher cette course (si ses fonds sont encore en
      // attente). S'ils sont déjà libérés, c'est au support de les ajuster (wallet.adjust) — on le signale.
      await this.wallets.reverseHeldFunds({
        driverId: booking.trip.driverId,
        bookingId,
        reason: 'Remboursement intégral du client',
      });
      await this.warnIfFundsAlreadyReleased({ bookingId }, 'réservation');
    }
    await this.notifications.notify({
      userId: booking.customer.userId,
      type: NotificationType.REFUND,
      channels: [NotificationChannel.PUSH, NotificationChannel.SMS, NotificationChannel.EMAIL],
      fallbackTitle: 'Remboursement effectué',
      fallbackBody: `Votre remboursement (${refundPercentage}%) a été traité.`,
    });
  }

  async refundShipment(shipmentId: string, refundPercentage: number): Promise<void> {
    if (Math.round(refundPercentage) <= 0) return;
    const payment = await this.prisma.payment.findUnique({ where: { shipmentId } });
    if (!payment || payment.status !== PaymentStatus.CAPTURED) return;
    await this.executeRefund(payment, refundPercentage);
    // Le statut REFUNDED du Shipment est déjà posé par
    // ShipmentsService.cancel (CANCELLED) — un envoi remboursé après
    // annulation reste CANCELLED, section 20 ne prévoit pas de double
    // statut ; seul Payment.status distingue "remboursé" de "non remboursé".
    const shipment = await this.prisma.shipment.findUniqueOrThrow({
      where: { id: shipmentId },
      include: { customer: true },
    });
    if (refundPercentage >= 100 && shipment.driverId) {
      await this.wallets.reverseHeldFunds({
        driverId: shipment.driverId,
        shipmentId,
        reason: 'Remboursement intégral du client',
      });
      await this.warnIfFundsAlreadyReleased({ shipmentId }, 'envoi');
    }
    await this.notifications.notify({
      userId: shipment.customer.userId,
      type: NotificationType.REFUND,
      channels: [NotificationChannel.PUSH, NotificationChannel.SMS, NotificationChannel.EMAIL],
      fallbackTitle: 'Remboursement effectué',
      fallbackBody: `Votre remboursement (${refundPercentage}%) a été traité.`,
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

  private async executeRefund(
    payment: { id: string; amount: bigint; currencyId: string },
    refundPercentage: number,
  ): Promise<void> {
    const clampedPercentage = Math.max(0, Math.min(100, refundPercentage));
    if (clampedPercentage === 0) return;

    const refundAmount = BigInt(Math.round(Number(payment.amount) * (clampedPercentage / 100)));
    const capturedTransaction = await this.prisma.paymentTransaction.findFirst({
      where: { paymentId: payment.id, status: PaymentStatus.CAPTURED },
      orderBy: { createdAt: 'desc' },
      include: { provider: true },
    });
    if (!capturedTransaction) return;

    const adapter = this.registry.resolve(capturedTransaction.provider.type);
    const refundResult = await adapter.refund({
      externalReference: capturedTransaction.externalReference!,
      amount: refundAmount,
    });

    await this.prisma.paymentTransaction.create({
      data: {
        paymentId: payment.id,
        providerId: capturedTransaction.providerId,
        externalReference: refundResult.externalReference,
        amount: refundAmount,
        currencyId: payment.currencyId,
        status: PaymentStatus.REFUNDED,
      },
    });

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: clampedPercentage >= 100 ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED,
      },
    });
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