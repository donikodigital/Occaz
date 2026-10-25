// backend/src/accounting/dto/accounting-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class AccountingQueryDto {
  @ApiPropertyOptional({ example: 2026, description: "Année comptable (janvier à décembre). Par défaut : l'année en cours." })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year?: number;
}
