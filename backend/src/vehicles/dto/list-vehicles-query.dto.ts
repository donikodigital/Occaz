// backend/src/vehicles/dto/list-vehicles-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/** Même correctif que ListDriverProfilesQueryDto — voir ce fichier pour le pourquoi. */
export class ListVehiclesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: DocumentStatus })
  @IsOptional()
  @IsEnum(DocumentStatus)
  verificationStatus?: DocumentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  driverId?: string;
}