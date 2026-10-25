// backend/src/accounting/dto/staff-pay.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';

export class AllowanceDto {
  @ApiProperty({ example: 'Prime de transport' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  label: string;

  @ApiProperty({ description: 'Montant mensuel, entier supérieur à zéro (plus petite unité de la devise)' })
  @IsString()
  @Matches(/^[1-9]\d{0,14}$/, { message: 'Le montant doit être un nombre entier supérieur à zéro.' })
  amount: string;
}

export class DeductionDto {
  @ApiProperty({ example: 'Cotisation sociale' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  label: string;

  @ApiProperty({ enum: ['PERCENT', 'FIXED'] })
  @IsIn(['PERCENT', 'FIXED'])
  kind: 'PERCENT' | 'FIXED';

  @ApiProperty({ description: 'PERCENT : centièmes de pour cent (500 = 5 %) ; FIXED : montant entier' })
  @IsString()
  @Matches(/^[1-9]\d{0,14}$/, { message: 'La valeur doit être un nombre entier supérieur à zéro.' })
  value: string;
}

/** Fiche de paie d'un membre de l'équipe. Les taux de retenue sont à fixer avec le comptable : l'application n'en impose aucun. */
export class UpsertStaffPayProfileDto {
  @ApiPropertyOptional({ description: "Nom affiché sur le bulletin pour un compte sans identité (SuperAdmin)" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  fullName?: string;

  @ApiPropertyOptional({ example: 'EMP-014' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  employeeNumber?: string;

  @ApiPropertyOptional({ example: 'Agent support' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  jobTitle?: string;

  @ApiPropertyOptional({ example: '2025-03-01' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "La date d'embauche doit être au format AAAA-MM-JJ." })
  hireDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  socialSecurityNumber?: string;

  @ApiProperty({ description: 'Salaire de base mensuel, entier supérieur à zéro' })
  @IsString()
  @Matches(/^[1-9]\d{0,14}$/, { message: 'Le salaire de base doit être un nombre entier supérieur à zéro.' })
  baseSalary: string;

  @ApiProperty({ description: 'Devise du salaire (id)' })
  @IsString()
  @IsNotEmpty()
  currencyId: string;

  @ApiPropertyOptional({ type: [AllowanceDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AllowanceDto)
  allowances?: AllowanceDto[];

  @ApiPropertyOptional({ type: [DeductionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => DeductionDto)
  deductions?: DeductionDto[];
}
