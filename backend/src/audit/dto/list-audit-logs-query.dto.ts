// backend/src/audit/dto/list-audit-logs-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/**
 * entityType, entityId et actorId n'existent pas sur PaginationQueryDto. Les
 * lier via des @Query('…') séparés, à côté de @Query() query:
 * PaginationQueryDto, fait rejeter toute la requête en 400 ("property
 * entityType should not exist") quand le ValidationPipe global a
 * forbidNonWhitelisted: true — avant même d'atteindre le contrôleur. Les
 * déclarer ici, dans le même DTO que le reste de la query, règle le problème
 * (même cause que ListUsersQueryDto et ListCitiesQueryDto).
 */
export class ListAuditLogsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'PaymentProvider', description: "Type d'élément concerné (nom du modèle)." })
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional({ description: "Identifiant de l'élément concerné." })
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional({ description: "Identifiant de l'utilisateur qui a fait l'action." })
  @IsOptional()
  @IsString()
  actorId?: string;
}