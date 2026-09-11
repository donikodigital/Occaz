// backend/src/payments/dto/initiate-payment.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class InitiatePaymentDto {
  @ApiPropertyOptional({ description: 'Exactement un des deux : bookingId ou shipmentId' })
  @IsOptional()
  @IsString()
  bookingId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shipmentId?: string;

  @ApiProperty({ description: 'PaymentProvider choisi par le client (voir GET /payment-providers/active)' })
  @IsString()
  providerId: string;
}
