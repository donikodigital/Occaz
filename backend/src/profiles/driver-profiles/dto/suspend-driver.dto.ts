// backend/src/profiles/driver-profiles/dto/suspend-driver.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SuspendDriverDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  reason: string;
}
