// backend/src/platform-wallet/dto/platform-wallet.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExpenseCategory, PlatformBeneficiaryKind, PlatformWithdrawalStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
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

/** Fournisseur d'un achat (fournitures, équipements). */
export class ExpenseSupplierDto {
  @ApiProperty({ example: 'Papeterie Moderne' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ description: 'Numéro de la facture remise par le fournisseur' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  invoiceRef?: string;
}

/** Une ligne de facture ou de note de frais. Le total de la ligne est toujours recalculé par le serveur. */
export class ExpenseLineDto {
  @ApiProperty({ example: 'Ramettes de papier A4' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  description: string;

  @ApiProperty({ minimum: 1, maximum: 100000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  quantity: number;

  @ApiProperty({ description: 'Prix unitaire, entier supérieur à zéro (plus petite unité de la devise)' })
  @IsString()
  @Matches(/^[1-9]\d{0,14}$/, { message: 'Le prix unitaire doit être un nombre entier supérieur à zéro.' })
  unitPrice: string;
}

export class ExpenseTravelDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  traveler: string;

  @ApiProperty({ example: 'Conakry' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  from: string;

  @ApiProperty({ example: 'Labé' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  to: string;

  @ApiPropertyOptional({ example: '2026-10-20' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La date de départ doit être au format AAAA-MM-JJ.' })
  departureDate?: string;

  @ApiPropertyOptional({ example: '2026-10-23' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La date de retour doit être au format AAAA-MM-JJ.' })
  returnDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  purpose?: string;
}

/**
 * Le MOTIF d'un retrait et ce qu'il exige (voir expense-categories.ts) :
 *   SALARY → staffUserId + periodMonth (le montant est le net calculé) · BONUS → staffUserId + reason · OPERATING → reason
 *   TRAVEL → travel (+ lines facultatives) · SUPPLIES / OFFICE_EQUIPMENT → supplier + lines · OTHER → categoryLabel + reason
 */
export class ExpenseMotifDto {
  @ApiProperty({ enum: ExpenseCategory })
  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;

  @ApiPropertyOptional({ description: 'Motif saisi quand la catégorie est OTHER' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  categoryLabel?: string;

  @ApiPropertyOptional({ description: "Objet de la dépense / raison de la prime" })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;

  @ApiPropertyOptional({ description: 'Membre du personnel concerné (SALARY, BONUS)' })
  @IsOptional()
  @IsString()
  staffUserId?: string;

  @ApiPropertyOptional({ example: '2026-10', description: 'Mois du salaire (AAAA-MM)' })
  @IsOptional()
  @IsString()
  periodMonth?: string;

  @ApiPropertyOptional({ type: ExpenseSupplierDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExpenseSupplierDto)
  supplier?: ExpenseSupplierDto;

  @ApiPropertyOptional({ type: [ExpenseLineDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ExpenseLineDto)
  lines?: ExpenseLineDto[];

  @ApiPropertyOptional({ type: ExpenseTravelDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExpenseTravelDto)
  travel?: ExpenseTravelDto;
}

export class CreateWithdrawalDto extends ExpenseMotifDto {
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
  @Matches(/^[1-9]\d{0,14}$/, { message: 'Le montant doit être un nombre entier supérieur à zéro.' })
  amount: string;

  @ApiPropertyOptional({ description: 'Note libre (facultative)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;

  @ApiProperty({ description: 'Code à 6 chiffres reçu par e-mail pour CE retrait (POST /platform-wallet/withdrawals/code).' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Le code de confirmation comporte 6 chiffres.' })
  code: string;
}

/** Demande d'envoi du code de confirmation : décrit le retrait que le code protégera. */
export class RequestWithdrawalCodeDto extends ExpenseMotifDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  beneficiaryId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  currencyId: string;

  @ApiProperty({ description: 'Montant, plus petite unité de la devise (entier strictement positif)' })
  @IsString()
  @Matches(/^[1-9]\d{0,14}$/, { message: 'Le montant doit être un nombre entier supérieur à zéro.' })
  amount: string;
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

  @ApiPropertyOptional({ enum: ExpenseCategory })
  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;

  @ApiPropertyOptional({ example: 2026, description: 'Retraits demandés cette année-là' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional({ example: 10, description: "Retraits demandés ce mois-là (avec `year`)" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;
}

/** Aperçu du bulletin d'une personne pour un mois (le montant net remplit le retrait). */
export class PayslipPreviewQueryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  staffUserId: string;

  @ApiProperty({ example: '2026-10' })
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'Le mois doit être au format AAAA-MM.' })
  period: string;
}
