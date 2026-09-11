// backend/src/shipments/dto/assign-shipment.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AssignShipmentDto {
  @ApiProperty({ description: "Trajet du chauffeur auquel rattacher l'envoi" })
  @IsString()
  tripId: string;
}
