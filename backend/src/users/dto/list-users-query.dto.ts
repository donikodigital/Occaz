// backend/src/users/dto/list-users-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/**
 * accountType n'existe pas sur PaginationQueryDto. Le lier via un
 * @Query('accountType') séparé, à côté de @Query() query: PaginationQueryDto,
 * fait rejeter toute la requête en 400 ("property accountType should not
 * exist") quand le ValidationPipe global a forbidNonWhitelisted: true — avant
 * même d'atteindre le contrôleur. Le déclarer ici, dans le même DTO que le
 * reste de la query, règle le problème (même cause que ListCitiesQueryDto).
 */
export class ListUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: AccountType, description: 'Filtre par type de compte.' })
  @IsOptional()
  @IsEnum(AccountType)
  accountType?: AccountType;
}