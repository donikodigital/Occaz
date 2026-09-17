// backend/src/trips/dto/trip-stop-input.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class TripStopInputDto {
  @ApiProperty()
  @IsString()
  locationId!: string;

  @ApiProperty({ description: 'Ordre de passage (1, 2, 3...)' })
  @IsInt()
  @Min(1)
  sequence!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  estimatedArrivalAt?: string;
}