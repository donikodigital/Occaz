// backend/src/referrals/dto/complete-referral.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CompleteReferralDto {
  @ApiProperty({ description: 'Montant de la récompense, plus petite unité de la devise' })
  @IsString()
  rewardAmount: string;
}