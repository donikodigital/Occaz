// backend/src/profiles/driver-profiles/dto/list-driver-profiles-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DriverAccountStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/**
 * status/countryId n'existent pas sur PaginationQueryDto. Les lier via des
 * @Query() séparés sur le même handler que @Query() query:
 * PaginationQueryDto fait rejeter toute la requête en 400 si le
 * ValidationPipe global a forbidNonWhitelisted: true — avant même
 * d'atteindre le contrôleur (même bug que sur GET /cities et
 * GET /documents). Les déclarer ici, dans le même DTO que le reste de la
 * query, règle le problème quelle que soit la config du ValidationPipe.
 */
export class ListDriverProfilesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: DriverAccountStatus })
  @IsOptional()
  @IsEnum(DriverAccountStatus)
  status?: DriverAccountStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  countryId?: string;
}