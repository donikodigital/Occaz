// backend/src/trips/dto/cancel-trip.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CancelTripDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  reason!: string;
}