// backend/src/shipments/dto/search-shipment-drivers.dto.ts
// [09/10/2026] v1 — recherche de conducteurs par le client : la ville d'arrivée suffit, la ville de départ est facultative.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SearchShipmentDriversDto {
  @ApiProperty({ description: "Ville où le colis doit arriver — obligatoire : le conducteur doit s'y rendre." })
  @IsString()
  @IsNotEmpty()
  destinationCityId: string;

  @ApiPropertyOptional({
    description: 'Ville de départ du conducteur ou ville qu’il traverse avant l’arrivée. Facultative : sans elle, tout conducteur qui se rend à la ville d’arrivée est proposé.',
  })
  @IsOptional()
  @IsString()
  originCityId?: string;
}
