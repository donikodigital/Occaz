// backend/src/shipment-categories/dto/create-shipment-category.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateShipmentCategoryDto {
  @ApiProperty({ example: 'Documents' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isAllowed?: boolean;

  @ApiPropertyOptional({ description: 'null = règle globale, sinon spécifique à ce pays' })
  @IsOptional()
  @IsString()
  countryId?: string;

  @ApiPropertyOptional({ description: 'Plus petite unité de la devise' })
  @IsOptional()
  @IsString()
  maxDeclaredValue?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currencyId?: string;

  @ApiPropertyOptional({ default: 1.0, description: '1.0 = tarif standard, 1.5 = +50%...' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceMultiplier?: number;
}
