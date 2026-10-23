// backend/src/disputes/dto/list-disputes-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DisputePriority, DisputeStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/**
 * status, priority et assignedAgentId n'existent pas sur PaginationQueryDto. Les lier via des @Query('…') séparés, à côté de @Query() query: PaginationQueryDto,
 * fait rejeter toute la requête en 400 ("property … should not exist") quand le ValidationPipe global a forbidNonWhitelisted: true
 * — avant même d'atteindre le contrôleur : le filtre ne marchait donc jamais et la liste affichait une erreur. Les déclarer ici,
 * dans le même DTO que le reste de la query, règle le problème (même cause que ListUsersQueryDto et ListAuditLogsQueryDto).
 */
export class ListDisputesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: DisputeStatus, description: 'Filtre par statut.' })
  @IsOptional()
  @IsEnum(DisputeStatus)
  status?: DisputeStatus;

  @ApiPropertyOptional({ enum: DisputePriority, description: 'Filtre par priorité.' })
  @IsOptional()
  @IsEnum(DisputePriority)
  priority?: DisputePriority;

  @ApiPropertyOptional({ description: "Filtre par agent assigné (identifiant de l'utilisateur)." })
  @IsOptional()
  @IsString()
  assignedAgentId?: string;
}
