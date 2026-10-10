// backend/src/user-safety/dto/user-safety.dto.ts
// [11/10/2026] v1 — corps des requêtes de la sécurité : signalement, contact d'urgence, SOS, traitement par le support.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SosStatus, UserReportReason, UserReportStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Désigne la personne visée : l'application ne connaît que l'identifiant du profil conducteur (sur un trajet) ou client (sur une
 * réservation), pas celui du compte. Exactement UNE des trois références est attendue (vérifié par le service).
 */
export class UserTargetDto {
  @ApiPropertyOptional({ description: 'Identifiant du compte utilisateur.' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Identifiant du profil conducteur.' })
  @IsOptional()
  @IsUUID()
  driverId?: string;

  @ApiPropertyOptional({ description: 'Identifiant du profil client.' })
  @IsOptional()
  @IsUUID()
  customerId?: string;
}

export class CreateUserReportDto extends UserTargetDto {
  @ApiProperty({ enum: UserReportReason })
  @IsEnum(UserReportReason)
  reason: UserReportReason;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tripId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  bookingId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  shipmentId?: string;

  @ApiPropertyOptional({ description: 'Bloquer aussi cet utilisateur en même temps.' })
  @IsOptional()
  @IsBoolean()
  alsoBlock?: boolean;
}

export class BlockUserDto extends UserTargetDto {}

export class UpdateUserReportDto {
  @ApiProperty({ enum: UserReportStatus })
  @IsEnum(UserReportStatus)
  status: UserReportStatus;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resolutionNote?: string;
}

export class CreateEmergencyContactDto {
  @ApiProperty({ example: 'Mariama (sœur)' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name: string;

  @ApiProperty({ example: '+224620000000' })
  @IsPhoneNumber(undefined, { message: 'Numéro de téléphone invalide (format international requis).' })
  phone: string;
}

export class CreateSosDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tripId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  bookingId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  shipmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  message?: string;
}

export class UpdateSosLocationDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @IsLatitude()
  latitude: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @IsLongitude()
  longitude: number;
}

export class HandleSosDto {
  @ApiProperty({ enum: [SosStatus.ACKNOWLEDGED, SosStatus.RESOLVED] })
  @IsIn([SosStatus.ACKNOWLEDGED, SosStatus.RESOLVED])
  status: typeof SosStatus.ACKNOWLEDGED | typeof SosStatus.RESOLVED;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resolutionNote?: string;
}
