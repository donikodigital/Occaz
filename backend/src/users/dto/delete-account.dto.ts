// backend/src/users/dto/delete-account.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DeleteAccountDto {
  @ApiPropertyOptional({ description: 'Motif facultatif, à usage interne (amélioration produit).' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}