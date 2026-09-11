// backend/src/auth/dto/verify-otp.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsPhoneNumber, IsOptional, IsString, Length, ValidateNested } from 'class-validator';
import { DeviceInfoDto } from './device-info.dto';

export class VerifyOtpDto {
  @ApiProperty({ example: '+224620000000' })
  @IsPhoneNumber(undefined, { message: 'Numéro de téléphone invalide (format international requis).' })
  phone: string;

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
