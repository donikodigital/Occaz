// backend/src/wallets/dto/fail-payout.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class FailPayoutDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  reason: string;
}
