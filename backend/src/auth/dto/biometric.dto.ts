// backend/src/auth/dto/biometric.dto.ts
// Connexion rapide par empreinte digitale (ou visage) : activation, connexion, désactivation.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, Length, Matches, MaxLength, ValidateNested } from 'class-validator';
import { DeviceInfoDto } from './device-info.dto';
import { TrustedDeviceCredentialDto } from './trusted-device.dto';

export class EnableBiometricDto {
  @ApiProperty({ example: '482913', description: 'Mot de passe actuel (6 chiffres) : confirme que c\'est bien le propriétaire qui active la fonction.' })
  @Matches(/^\d{6}$/, { message: 'Le mot de passe doit contenir exactement 6 chiffres.' })
  password: string;

  @ApiPropertyOptional({ enum: ['ios', 'android'] })
  @IsOptional()
  @IsIn(['ios', 'android'])
  platform?: 'ios' | 'android';

  @ApiPropertyOptional({ example: 'Pixel 8', description: 'Nom du téléphone, affiché dans la liste des appareils.' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;
}

export class BiometricLoginDto {
  @ApiProperty()
  @IsUUID()
  credentialId: string;

  @ApiProperty({ description: 'Secret gardé sur le téléphone, déverrouillé par l\'empreinte.' })
  @IsString()
  @Length(32, 128)
  token: string;

  @ApiPropertyOptional({ type: DeviceInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DeviceInfoDto)
  device?: DeviceInfoDto;

  @ApiPropertyOptional({ type: TrustedDeviceCredentialDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TrustedDeviceCredentialDto)
  trustedDevice?: TrustedDeviceCredentialDto;
}

export class DisableBiometricDto {
  @ApiProperty()
  @IsUUID()
  credentialId: string;
}
