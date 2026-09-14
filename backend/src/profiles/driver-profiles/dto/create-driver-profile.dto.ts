// backend/src/profiles/driver-profiles/dto/create-driver-profile.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateDriverProfileDto {
  @ApiProperty({ example: 'Mamadou' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Barry' })
  @IsString()
  lastName: string;

  @ApiPropertyOptional({ description: 'Optionnel — permet de recevoir aussi les notifications par email, en plus du push.' })
  @IsOptional()
  @IsEmail()
  email?: string;

  /** Toujours vide à cette étape en pratique — aucune photo ne peut encore
   * exister avant la création du profil (le storageKey n'existe pas tant
   * qu'aucun upload n'a eu lieu). La vraie photo arrive via le flux en 2
   * temps POST me/photo/upload-url puis POST me/photo, obligatoire avant
   * que verify() n'accepte de valider ce chauffeur. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  photoUrl?: string;

  @ApiProperty()
  @IsString()
  countryId: string;

  @ApiProperty()
  @IsString()
  cityId: string;

  @ApiPropertyOptional({ example: '1990-01-20' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ description: 'Numéro mobile money pour les retraits' })
  @IsOptional()
  @IsString()
  mobileMoneyNumber?: string;
}
