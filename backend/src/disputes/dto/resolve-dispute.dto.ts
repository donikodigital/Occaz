// backend/src/disputes/dto/resolve-dispute.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DisputeResolutionType, OtpPurpose } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class ResolveDisputeDto {
  @ApiProperty({ enum: DisputeResolutionType })
  @IsEnum(DisputeResolutionType)
  type: DisputeResolutionType;

  @ApiPropertyOptional({
    description:
      'Montant à rembourser, plus petite unité — requis pour PARTIAL_REFUND/SHARED_RESPONSIBILITY. Ignoré pour FULL_REFUND (calculé automatiquement à 100%).',
  })
  @IsOptional()
  @IsString()
  refundAmount?: string;

  @ApiPropertyOptional({
    description:
      "Part du prix remboursée au client (0 à 100) pour une résolution CANCELLATION. Par défaut 100 : une annulation décidée par l'arbitre rembourse intégralement, le client n'est pas pénalisé.",
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  refundPercentage?: number;

  @ApiPropertyOptional({
    enum: OtpPurpose,
    description:
      "Étape à valider manuellement sans code — requis pour OTP_MANUAL_VALIDATION. TRIP_PICKUP/TRIP_DROPOFF pour un litige trajet, SHIPMENT_PICKUP/SHIPMENT_DELIVERY pour un litige envoi.",
  })
  @IsOptional()
  @IsEnum(OtpPurpose)
  otpPurpose?: OtpPurpose;

  @ApiPropertyOptional({ description: 'Utilisateur visé par une SUSPENSION' })
  @IsOptional()
  @IsString()
  targetUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  notes?: string;
}