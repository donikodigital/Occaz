// backend/src/rbac/dto/assign-role.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AssignRoleDto {
  @ApiProperty()
  @IsString()
  userId: string;

  @ApiProperty()
  @IsString()
  roleId: string;

  @ApiPropertyOptional({
    description:
      'Portée géographique optionnelle : limite ce rôle aux ressources de ce pays (ex: agent support local).',
  })
  @IsOptional()
  @IsString()
  countryId?: string;
}
