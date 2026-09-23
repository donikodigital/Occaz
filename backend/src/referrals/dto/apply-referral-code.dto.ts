// backend/src/referrals/dto/apply-referral-code.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ApplyReferralCodeDto {
  @ApiProperty({ example: 'AB3D9FGH' })
  @IsString()
  code: string;
}