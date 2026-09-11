// backend/src/rbac/dto/create-role.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, Matches } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'support_supervisor' })
  @IsString()
  @Matches(/^[a-z0-9_]+$/, {
    message: 'La clé du rôle doit être en snake_case minuscule (ex: support_supervisor).',
  })
  key: string;

  @ApiProperty({ example: 'Superviseur clientèle' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [String], description: 'Clés de permission à associer' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionKeys?: string[];
}
