// backend/src/disputes/dto/resolve-dispute.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DisputeResolutionType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

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
