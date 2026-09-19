// backend/src/dashboards/dto/commission-summary-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export const COMMISSION_SUMMARY_PERIODS = ['week', 'month', 'quarter', 'year'] as const;
export type CommissionSummaryPeriod = (typeof COMMISSION_SUMMARY_PERIODS)[number];

export class CommissionSummaryQueryDto {
  @ApiPropertyOptional({ enum: COMMISSION_SUMMARY_PERIODS, default: 'month' })
  @IsOptional()
  @IsIn(COMMISSION_SUMMARY_PERIODS)
  period?: CommissionSummaryPeriod = 'month';
}