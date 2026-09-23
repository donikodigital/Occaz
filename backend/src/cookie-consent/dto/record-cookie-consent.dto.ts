// backend/src/cookie-consent/dto/record-cookie-consent.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CookieConsentChoice } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export class RecordCookieConsentDto {
  @ApiProperty({ enum: CookieConsentChoice })
  @IsEnum(CookieConsentChoice)
  choice: CookieConsentChoice;

  @ApiProperty({ description: 'Version du texte affiché au moment du choix' })
  @IsString()
  policyVersion: string;

  @ApiPropertyOptional({ description: 'Détail par catégorie si choice = CUSTOM' })
  @IsOptional()
  @IsObject()
  categories?: Record<string, boolean>;
}