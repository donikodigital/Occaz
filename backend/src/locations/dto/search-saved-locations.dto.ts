// backend/src/locations/dto/search-saved-locations.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SearchSavedLocationsDto {
  @ApiPropertyOptional({
    example: 'Bambeto',
    description: 'Texte recherché dans le libellé, l\'adresse ou la ville. Sans texte : les adresses les plus récentes.',
  })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiPropertyOptional({ default: 8 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}