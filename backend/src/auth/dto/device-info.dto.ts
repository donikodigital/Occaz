// backend/src/auth/dto/device-info.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class DeviceInfoDto {
  @ApiPropertyOptional({ enum: ['ios', 'android', 'web'] })
  @IsOptional()
  @IsIn(['ios', 'android', 'web'])
  platform?: 'ios' | 'android' | 'web';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pushToken?: string;
}
