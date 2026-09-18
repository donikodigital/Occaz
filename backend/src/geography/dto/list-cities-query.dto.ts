// backend/src/geography/dto/list-cities-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/**
 * countryId n'existe pas sur PaginationQueryDto. Le lier via un @Query()
 * séparé sur le même handler que @Query() query: PaginationQueryDto fait
 * rejeter toute la requête en 400 si le ValidationPipe global a
 * forbidNonWhitelisted: true — avant même d'atteindre le contrôleur.
 * Le déclarer ici, dans le même DTO que le reste de la query, règle le
 * problème quelle que soit la config du ValidationPipe.
 */
export class ListCitiesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  countryId?: string;
}