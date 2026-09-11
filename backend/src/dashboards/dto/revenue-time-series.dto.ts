// backend/src/dashboards/dto/revenue-time-series.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsIn } from 'class-validator';

export class RevenueTimeSeriesDto {
  @ApiProperty({ enum: ['day', 'week', 'month', 'year'] })
  @IsIn(['day', 'week', 'month', 'year'])
  granularity: 'day' | 'week' | 'month' | 'year';

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  from: string;

  @ApiProperty({ example: '2026-12-31' })
  @IsDateString()
  to: string;
}
