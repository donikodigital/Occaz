// backend/src/trips/dto/cancel-booking.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CancelBookingDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  reason: string;
}
