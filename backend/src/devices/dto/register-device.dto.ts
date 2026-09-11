// backend/src/devices/dto/register-device.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class RegisterDeviceDto {
  @ApiProperty({ enum: ['ios', 'android', 'web'] })
  @IsIn(['ios', 'android', 'web'])
  platform: 'ios' | 'android' | 'web';

  @ApiPropertyOptional({ description: 'Token push Expo/Firebase' })
  @IsOptional()
  @IsString()
  pushToken?: string;
}
