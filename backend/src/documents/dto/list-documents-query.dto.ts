// backend/src/documents/dto/list-documents-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentOwnerType, DocumentStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/**
 * ownerType/ownerId/status n'existent pas sur PaginationQueryDto. Les lier
 * via des @Query() séparés sur le même handler que @Query() query:
 * PaginationQueryDto fait rejeter toute la requête en 400 si le
 * ValidationPipe global a forbidNonWhitelisted: true — avant même
 * d'atteindre le contrôleur (même bug que sur GET /cities). Les déclarer
 * ici, dans le même DTO que le reste de la query, règle le problème quelle
 * que soit la config du ValidationPipe.
 */
export class ListDocumentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: DocumentOwnerType })
  @IsOptional()
  @IsEnum(DocumentOwnerType)
  ownerType?: DocumentOwnerType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional({ enum: DocumentStatus })
  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;
}