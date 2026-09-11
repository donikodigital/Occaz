// backend/src/rbac/dto/create-permission.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty({ example: 'dispute.resolve' })
  @IsString()
  @Matches(/^[a-z_]+\.[a-z_]+$/, {
    message: 'La clé de permission doit suivre le format "domaine.action" (ex: dispute.resolve).',
  })
  key: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
