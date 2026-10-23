// backend/src/articles/dto/list-published-articles-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/**
 * countryId n'existe pas sur PaginationQueryDto. Les lier via des @Query('…') séparés, à côté de @Query() query: PaginationQueryDto,
 * fait rejeter toute la requête en 400 ("property … should not exist") quand le ValidationPipe global a forbidNonWhitelisted: true
 * — avant même d'atteindre le contrôleur : le filtre ne marchait donc jamais et la liste affichait une erreur. Les déclarer ici,
 * dans le même DTO que le reste de la query, règle le problème (même cause que ListUsersQueryDto et ListAuditLogsQueryDto).
 */
export class ListPublishedArticlesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Actualités du pays (identifiant) en plus des actualités générales.' })
  @IsOptional()
  @IsString()
  countryId?: string;
}
