// backend/src/platform-wallet/dto/platform-wallet.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlatformBeneficiaryKind, PlatformWithdrawalStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/** Numéros acceptés avec espaces, tirets ou points ; enregistrés en « +224620004417 ». */
const stripPhone = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.replace(/[\s.\-()]/g, '') : value);

export const PLATFORM_PAYMENT_METHODS = ['orange_money', 'mobile_money'] as const;

export class CreateBeneficiaryDto {
  @ApiProperty({ example: 'Mon Orange Money' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  label: string;

  @ApiProperty({ example: 'Thierno Doniko' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  holderName: string;

  @ApiProperty({ enum: PlatformBeneficiaryKind })
  @IsEnum(PlatformBeneficiaryKind)
  kind: PlatformBeneficiaryKind;

  @ApiProperty({ example: '+224620004417', description: 'Numéro Orange Money, format international' })
  @Transform(stripPhone)
  @Matches(/^\+\d{8,15}$/, { message: 'Le numéro doit être au format international, par exemple +224620004417.' })
  phone: string;

  @ApiPropertyOptional({ enum: PLATFORM_PAYMENT_METHODS })
  @IsOptional()
  @IsIn(PLATFORM_PAYMENT_METHODS)
  method?: string;
}

export class UpdateBeneficiaryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  holderName?: string;

  @ApiPropertyOptional({ enum: PlatformBeneficiaryKind })
  @IsOptional()
  @IsEnum(PlatformBeneficiaryKind)
  kind?: PlatformBeneficiaryKind;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(stripPhone)
  @Matches(/^\+\d{8,15}$/, { message: 'Le numéro doit être au format international, par exemple +224620004417.' })
  phone?: string;

  @ApiPropertyOptional({ enum: PLATFORM_PAYMENT_METHODS })
  @IsOptional()
  @IsIn(PLATFORM_PAYMENT_METHODS)
  method?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateWithdrawalDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  beneficiaryId: string;

  @ApiProperty({ description: 'Devise à retirer (id de la devise : XOF ou GNF)' })
  @IsString()
  @IsNotEmpty()
  currencyId: string;

  @ApiProperty({ description: 'Montant, plus petite unité de la devise (entier)' })
  @IsString()
  @Matches(/^\d+$/, { message: 'Le montant doit être un nombre entier.' })
  amount: string;

  @ApiPropertyOptional({ description: 'Motif (ex. « Commissions de septembre », « Prime équipe support »)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;

  @ApiProperty({ description: 'Mot de passe du compte connecté : un retrait d\'argent exige une confirmation.' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class ResolveWithdrawalDto {
  @ApiPropertyOptional({ description: 'Référence de la transaction Orange Money (reçu du virement fait à la main)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalReference?: string;
}

export class FailWithdrawalDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  reason: string;
}

export class ListWithdrawalsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: PlatformWithdrawalStatus })
  @IsOptional()
  @IsEnum(PlatformWithdrawalStatus)
  status?: PlatformWithdrawalStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currencyId?: string;
}
