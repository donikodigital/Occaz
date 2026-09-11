// backend/src/shipments/dto/cancel-shipment.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CancelShipmentDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  reason: string;
}
