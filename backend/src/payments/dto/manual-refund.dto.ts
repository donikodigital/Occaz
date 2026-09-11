// backend/src/payments/dto/manual-refund.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

/**
 * Remboursement déclenché manuellement par le support (hors flux
 * d'annulation automatique) — typiquement en résolution d'un litige
 * (section 22, Lot 7). `reason` est tracé dans le journal d'audit.
 */
export class ManualRefundDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  reason: string;

  @ApiPropertyOptional({ default: 100, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  percentage?: number;
}
