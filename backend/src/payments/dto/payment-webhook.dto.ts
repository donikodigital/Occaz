// backend/src/payments/dto/payment-webhook.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';

/**
 * Forme générique attendue des webhooks entrants. Un prestataire réel
 * (Orange Money...) a son propre format exact — ce DTO documente le
 * contrat minimal que PaymentsService.confirmWebhook sait interpréter ;
 * un futur provider-specific adapter pourra normaliser vers cette forme
 * avant d'appeler ce endpoint, sans toucher à la logique de confirmation.
 */
export class PaymentWebhookDto {
  @ApiProperty({ description: 'Doit correspondre à PaymentTransaction.externalReference' })
  @IsString()
  externalReference: string;

  @ApiProperty({ enum: ['SUCCESS', 'FAILED'] })
  @IsIn(['SUCCESS', 'FAILED'])
  status: 'SUCCESS' | 'FAILED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  raw?: Record<string, unknown>;
}
