// backend/src/disputes/dto/add-dispute-evidence.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class AddDisputeEvidenceDto {
  @ApiProperty({ example: 'photo_colis_endommage' })
  @IsString()
  type: string;

  @ApiProperty({ description: "Clé de l'objet dans le stockage sécurisé" })
  @IsString()
  storageKey: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
