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
}
