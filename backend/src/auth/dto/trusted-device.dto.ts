// backend/src/auth/dto/trusted-device.dto.ts
// Téléphones de confiance et vérification d'un nouveau téléphone par code.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, Length, MaxLength, ValidateNested } from 'class-validator';
import { DeviceInfoDto } from './device-info.dto';

/** Ce que le téléphone présente à la connexion pour prouver qu'il est de confiance. */
export class TrustedDeviceCredentialDto {
  @ApiProperty()
  @IsUUID()
  id: string;

  @ApiProperty()
  @IsString()
  @Length(32, 128)
  secret: string;
}

export class RegisterTrustedDeviceDto {
  @ApiPropertyOptional({ enum: ['ios', 'android'] })
  @IsOptional()
  @IsIn(['ios', 'android'])
  platform?: 'ios' | 'android';

  @ApiPropertyOptional({ example: 'Pixel 8' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;
}

export class VerifyDeviceDto {
  @ApiProperty({ description: 'Jeton remis par la connexion qui a demandé la vérification.' })
  @IsString()
  challengeToken: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  code: string;

  @ApiPropertyOptional({ type: DeviceInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DeviceInfoDto)
  device?: DeviceInfoDto;
}

export class ResendDeviceCodeDto {
  @ApiProperty()
  @IsString()
  challengeToken: string;

  @ApiPropertyOptional({ enum: ['SMS'], description: 'SMS : recevoir le code par SMS plutôt que par e-mail.' })
  @IsOptional()
  @IsIn(['SMS'])
  channel?: 'SMS';
}
