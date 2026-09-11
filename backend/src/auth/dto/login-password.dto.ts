// backend/src/auth/dto/login-password.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { DeviceInfoDto } from './device-info.dto';

/**
 * Réservé aux comptes SUPPORT / SUPERADMIN (section 36 : "mot de passe
 * lorsque nécessaire") — clients et chauffeurs s'authentifient uniquement
 * par téléphone + OTP.
 */
export class LoginPasswordDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ description: 'Requis si la 2FA est activée sur le compte.' })
  @IsOptional()
  @IsString()
  twoFactorCode?: string;

  @ApiPropertyOptional({ type: DeviceInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DeviceInfoDto)
  device?: DeviceInfoDto;
}
