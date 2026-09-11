// backend/src/verifications/dto/create-verification.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VerificationType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

/**
 * PHONE n'est volontairement pas couvert ici : la vérification du
 * téléphone se fait via l'OTP de connexion (User.isPhoneVerified, Lot 1)
 * et ne passe pas par ce workflow documentaire.
 */
export class CreateVerificationDto {
  @ApiProperty({ enum: [VerificationType.IDENTITY, VerificationType.DRIVER_LICENSE, VerificationType.VEHICLE_REGISTRATION] })
  @IsEnum(VerificationType)
  type: VerificationType;

  @ApiPropertyOptional({ description: 'Document déjà téléversé servant de justificatif (voir POST /driver-profiles/me/documents)' })
  @IsOptional()
  @IsString()
  documentId?: string;
}
