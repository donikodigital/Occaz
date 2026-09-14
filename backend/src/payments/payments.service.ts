// backend/src/payments/payments.service.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BookingStatus, NotificationChannel, NotificationType, PaymentProviderType, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentProvidersService } from '../payment-providers/payment-providers.service';
import { PaymentProviderRegistry } from './providers/payment-provider-registry.service';
import { WalletsService } from '../wallets/wallets.service';
import { BookingsService } from '../trips/bookings.service';
import { ShipmentsService } from '../shipments/shipments.service';
import { NotificationsService } from '../notifications/notifications.service';
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
 *   - WalletsService : où va l'argent côté chauffeur (hold / release)
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

  private async settleTransaction(
    providerType: PaymentProviderType,
    externalReference: string,
    status: 'CAPTURED' | 'FAILED',
    rawPayload: unknown,
  ) {
    const transaction = await this.prisma.paymentTransaction.findFirst({
      where: { externalReference },
    });
    if (!transaction) throw new NotFoundException('Transaction introuvable.');

    if (transaction.status === PaymentStatus.CAPTURED) {
      // Webhook rejoué : idempotent, on ne retraite pas une seconde fois.
      return { paymentId: transaction.paymentId, status: transaction.status };
    }

    await this.prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status,
        webhookReceivedAt: new Date(),
        rawPayload: rawPayload as never,
      },
    });

    const payment = await this.prisma.payment.update({
      where: { id: transaction.paymentId },
      data: { status },
    });

    if (status === 'CAPTURED') {
      await this.handleCaptured(payment);
    }

    return { paymentId: payment.id, status };
  }

  private async handleCaptured(payment: {
    id: string;
    bookingId: string | null;
    shipmentId: string | null;
  }): Promise<void> {
    if (payment.bookingId) {
      const booking = await this.prisma.booking.findUniqueOrThrow({
        where: { id: payment.bookingId },
        include: { trip: true, customer: true },
      });
      await this.bookingsService.confirmPayment(booking.id);
      await this.wallets.holdBookingRevenue({
        driverId: booking.trip.driverId,
        bookingId: booking.id,
        grossAmount: (booking.totalAmount as bigint) - (booking.platformFee as bigint),
        commission: booking.platformFee,
      });
      await this.notifications.notify({
        userId: booking.customer.userId,
        type: NotificationType.PAYMENT,
        channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL],
        fallbackTitle: 'Paiement confirmé',
        fallbackBody: 'Votre paiement a été confirmé — votre réservation est validée.',
      });
    }

    if (payment.shipmentId) {
      const shipment = await this.prisma.shipment.findUniqueOrThrow({
        where: { id: payment.shipmentId },
        include: { trip: true, customer: true },
      });
      await this.shipmentsService.confirmPayment(shipment.id);
      if (shipment.trip) {
        // Un chauffeur était déjà choisi avant le paiement : on peut
        // provisionner tout de suite. Sinon (SEARCHING_DRIVER), le hold
        // est différé jusqu'à ShipmentsService.assignToTrip.
        await this.wallets.holdShipmentRevenue({
          driverId: shipment.trip.driverId,
          shipmentId: shipment.id,
          grossAmount: (shipment.totalAmount as bigint) - (shipment.platformFee as bigint),
          commission: shipment.platformFee,
        });
      }
      await this.notifications.notify({
        userId: shipment.customer.userId,
        type: NotificationType.PAYMENT,
        channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL],
        fallbackTitle: 'Paiement confirmé',
        fallbackBody: 'Votre paiement a été confirmé — nous recherchons un chauffeur pour votre envoi.',
      });
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
        include: { trip: true },
      });
      if (!shipment) return;

      await this.refundShipment(event.shipmentId, event.refundEligiblePercentage ?? 0);
      if (shipment.trip) {
        await this.wallets.reverseHeldFunds({
          driverId: shipment.trip.driverId,
          shipmentId: event.shipmentId,
          reason: event.reason,
        });
      }
    } catch (error) {
      this.logger.error(`Échec du remboursement pour l'envoi ${event.shipmentId}`, error as Error);
    }
  }

  async refundBooking(bookingId: string, refundPercentage: number): Promise<void> {
    const payment = await this.prisma.payment.findUnique({ where: { bookingId } });
    if (!payment || payment.status !== PaymentStatus.CAPTURED) return;
    await this.executeRefund(payment, refundPercentage);
    const booking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.REFUNDED },
      include: { customer: true },
    });
    await this.notifications.notify({
      userId: booking.customer.userId,
      type: NotificationType.REFUND,
      channels: [NotificationChannel.PUSH, NotificationChannel.SMS, NotificationChannel.EMAIL],
      fallbackTitle: 'Remboursement effectué',
      fallbackBody: `Votre remboursement (${refundPercentage}%) a été traité.`,
    });
  }

  async refundShipment(shipmentId: string, refundPercentage: number): Promise<void> {
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
    await this.notifications.notify({
      userId: shipment.customer.userId,
      type: NotificationType.REFUND,
      channels: [NotificationChannel.PUSH, NotificationChannel.SMS, NotificationChannel.EMAIL],
      fallbackTitle: 'Remboursement effectué',
      fallbackBody: `Votre remboursement (${refundPercentage}%) a été traité.`,
    });
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
