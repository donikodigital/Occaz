// backend/src/auth/dto/staff-code.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Length, ValidateNested } from 'class-validator';
import { DeviceInfoDto } from './device-info.dto';

/** Connexion de l'équipe (Support, Superviseur, Finance, SuperAdmin) par un code envoyé à leur adresse e-mail — jamais par SMS. */
export class RequestStaffCodeDto {
  @ApiProperty({ example: 'agent@occaz.sarl' })
  @IsEmail({}, { message: 'Adresse e-mail invalide.' })
  email: string;
}

export class VerifyStaffCodeDto {
  @ApiProperty({ example: 'agent@occaz.sarl' })
  @IsEmail({}, { message: 'Adresse e-mail invalide.' })
  email: string;

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
