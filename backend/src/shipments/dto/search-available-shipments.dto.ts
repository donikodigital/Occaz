// backend/src/shipments/dto/search-available-shipments.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/**
 * Envois en attente de chauffeur (section 12) — filtrable par ville de
 * départ/arrivée pour que le chauffeur retrouve les envois compatibles
 * avec ses trajets publiés.
 */
export class SearchAvailableShipmentsDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  originCityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  destinationCityId?: string;

  @ApiPropertyOptional({
    description:
      "Un de vos trajets : ne renvoie que les envois dont la ville de ramassage précède la ville de livraison sur sa route (villes traversées comprises) et dont la plage de dates couvre votre passage à la ville de ramassage.",
  })
  @IsOptional()
  @IsString()
  tripId?: string;
}
