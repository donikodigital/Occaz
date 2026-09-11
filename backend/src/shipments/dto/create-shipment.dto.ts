// backend/src/shipments/dto/create-shipment.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ShipmentItemInputDto } from './shipment-item-input.dto';

export class CreateShipmentDto {
  @ApiPropertyOptional({
    description:
      "Trajet choisi à l'avance (issu de GET /trips/search?requiresShipmentCapacity=true). Si omis, l'envoi passe en recherche de chauffeur (SEARCHING_DRIVER).",
  })
  @IsOptional()
  @IsString()
  tripId?: string;

  @ApiProperty()
  @IsString()
  categoryId: string;

  @ApiProperty({ example: 'Mamadou Diallo' })
  @IsString()
  senderName: string;

  @ApiProperty({ example: '+224620000001' })
  @IsString()
  senderPhone: string;

  @ApiProperty()
  @IsString()
  senderLocationId: string;

  @ApiProperty({ example: 'Aïssatou Bah' })
  @IsString()
  recipientName: string;

  @ApiProperty({ example: '+224620000002' })
  @IsString()
  recipientPhone: string;

  @ApiProperty()
  @IsString()
  recipientLocationId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 5 })
  @IsNumber()
  @Min(0.1)
  weightKg: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  lengthCm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  widthCm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  heightCm?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({ description: 'Valeur déclarée, plus petite unité de la devise' })
  @IsOptional()
  @IsString()
  declaredValue?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isUrgent?: boolean;

  @ApiPropertyOptional({ type: [ShipmentItemInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShipmentItemInputDto)
  items?: ShipmentItemInputDto[];
}
