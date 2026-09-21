// backend/src/shipments/dto/assign-shipment.dto.ts
// [21/09/2026] v2 — tripId facultatif : un chauffeur sans trajet peut accepter.
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AssignShipmentDto {
  @ApiPropertyOptional({
    description:
      "Trajet du chauffeur auquel rattacher l'envoi. Facultatif : un chauffeur validé sans trajet établi peut aussi accepter un envoi.",
  })
  @IsOptional()
  @IsString()
  tripId?: string;
}