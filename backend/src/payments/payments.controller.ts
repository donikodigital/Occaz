// backend/src/payments/payments.controller.ts
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaymentProviderType } from '@prisma/client';
import { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { ManualRefundDto } from './dto/manual-refund.dto';
import { CustomerProfilesService } from '../profiles/customer-profiles/customer-profiles.service';
import { AuditService } from '../audit/audit.service';

@ApiTags('Paiement')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly customerProfilesService: CustomerProfilesService,
    private readonly audit: AuditService,
  ) {}

  @ApiBearerAuth()
  @Post('initiate')
  async initiate(@Body() dto: InitiatePaymentDto, @CurrentUser() user: AuthenticatedUser) {
    const customer = await this.customerProfilesService.findByUserId(user.id);
    return this.paymentsService.initiate({ customerId: customer.id }, dto);
  }

  /**
   * Endpoint public (appelé par le prestataire, pas par un utilisateur
   * de l'app) — la sécurité vient de la vérification de signature propre
   * à chaque adaptateur (PaymentProviderAdapter.verifyAndParseWebhook),
   * pas d'un JWT. `:providerType` sélectionne l'adaptateur ; le body brut
   * et les en-têtes lui sont transmis tels quels pour qu'il valide
   * l'authenticité selon son propre schéma.
   */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('webhooks/:providerType')
  handleWebhook(
    @Param('providerType', new ParseEnumPipe(PaymentProviderType)) providerType: PaymentProviderType,
    @Body() rawPayload: unknown,
    @Headers() headers: Record<string, string>,
    @Req() request: Request,
  ) {
    return this.paymentsService.handleWebhook(providerType, rawPayload ?? request.body, headers);
  }

  /**
   * Remboursement déclenché manuellement par le support (ex : litige
   * résolu en faveur du client, section 22 — DisputeResolution du Lot 7
   * appellera cette même logique). Le remboursement automatique lié à une
   * annulation, lui, passe par les événements BOOKING_CANCELLED /
   * SHIPMENT_CANCELLED, jamais par cette route.
   */
  @ApiBearerAuth()
  @Permissions(PERMISSIONS.REFUND_CREATE)
  @Post('bookings/:bookingId/refund')
  async refundBooking(
    @Param('bookingId') bookingId: string,
    @Body() dto: ManualRefundDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.paymentsService.refundBooking(bookingId, dto.percentage ?? 100);
    await this.audit.log({
      actorId: user.id,
      entityType: 'Booking',
      entityId: bookingId,
      action: 'MANUAL_REFUND',
      diff: { reason: dto.reason, percentage: dto.percentage ?? 100 },
    });
    return { success: true };
  }

  @ApiBearerAuth()
  @Permissions(PERMISSIONS.REFUND_CREATE)
  @Post('shipments/:shipmentId/refund')
  async refundShipment(
    @Param('shipmentId') shipmentId: string,
    @Body() dto: ManualRefundDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.paymentsService.refundShipment(shipmentId, dto.percentage ?? 100);
    await this.audit.log({
      actorId: user.id,
      entityType: 'Shipment',
      entityId: shipmentId,
      action: 'MANUAL_REFUND',
      diff: { reason: dto.reason, percentage: dto.percentage ?? 100 },
    });
    return { success: true };
  }

  @ApiBearerAuth()
  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const payment = (await this.paymentsService.findOne(id)) as unknown as {
      bookingId: string | null;
      shipmentId: string | null;
    };

    if (!user.permissions.includes(PERMISSIONS.PAYMENT_READ)) {
      const customer = await this.customerProfilesService.findByUserId(user.id).catch(() => null);
      const isOwner = customer
        ? await this.paymentsService.isOwnedByCustomer(payment, customer.id)
        : false;
      if (!isOwner) {
        throw new ForbiddenException('Ce paiement ne vous appartient pas.');
      }
    }
    return payment;
  }
}
