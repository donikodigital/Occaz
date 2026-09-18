// backend/src/users/dto/admin-update-user.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Mise à jour d'un utilisateur par un administrateur (permission
 * USER_UPDATE) — distinct de UpdateUserDto (PATCH /users/me, self-service)
 * pour ne jamais mélanger les deux surfaces de validation. firstName/
 * lastName ne s'appliquent qu'aux comptes avec un profil client ou
 * chauffeur (voir UsersService.adminUpdate) — envoyés sur un compte
 * Support/SuperAdmin, ils sont refusés.
 */
export class AdminUpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;
}