// backend/src/shipments/dto/extend-shipment.dto.ts
// [21/09/2026] v1 — nouvelle fin de plage pour prolonger une demande.
import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class ExtendShipmentDto {
  @ApiProperty({
    example: '2026-10-02T18:00:00.000Z',
    description: 'Nouvelle fin de plage — doit être dans le futur.',
  })
  @IsDateString()
  windowEnd: string;
}