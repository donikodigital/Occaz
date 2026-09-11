// backend/src/shipments/dto/shipment-item-input.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUrl, Min } from 'class-validator';

export class ShipmentItemInputDto {
  @ApiProperty({ example: 'Carton de documents' })
  @IsString()
  label: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  weightKg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  photoUrl?: string;
}
