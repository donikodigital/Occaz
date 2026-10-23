// backend/src/verifications/dto/list-verifications-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { VerificationStatus, VerificationType } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/**
 * status et type n'existent pas sur PaginationQueryDto. Les lier via des @Query('…') séparés, à côté de @Query() query: PaginationQueryDto,
 * fait rejeter toute la requête en 400 ("property … should not exist") quand le ValidationPipe global a forbidNonWhitelisted: true
 * — avant même d'atteindre le contrôleur : le filtre ne marchait donc jamais et la liste affichait une erreur. Les déclarer ici,
 * dans le même DTO que le reste de la query, règle le problème (même cause que ListUsersQueryDto et ListAuditLogsQueryDto).
 */
export class ListVerificationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: VerificationStatus, description: 'Filtre par statut.' })
  @IsOptional()
  @IsEnum(VerificationStatus)
  status?: VerificationStatus;

  @ApiPropertyOptional({ enum: VerificationType, description: 'Filtre par type de vérification.' })
  @IsOptional()
  @IsEnum(VerificationType)
  type?: VerificationType;
}
