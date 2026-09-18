// backend/src/geography/dto/create-currency.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class CreateCurrencyDto {
  @ApiProperty({ example: 'GNF' })
  @IsString()
  @Length(3, 3)
  isoCode!: string;

  @ApiProperty({ example: 'Franc guinéen' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'FG' })
  @IsOptional()
  @IsString()
  symbol?: string;

  @ApiPropertyOptional({ default: 0, description: '0 pour GNF/XOF (pas de sous-unité)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  decimalDigits?: number;
}