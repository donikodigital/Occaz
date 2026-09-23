// backend/src/trips/dto/create-booking.dto.ts
// [23/09/2026] v+ — champ promoCode facultatif.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { PassengerInputDto } from './passenger-input.dto';

export class CreateBookingDto {
  @ApiProperty()
  @IsString()
  tripId!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  seatsCount!: number;

  @ApiPropertyOptional({
    type: [PassengerInputDto],
    description:
      "Passagers nommés pour une réservation de groupe — si fourni, la longueur doit être égale à seatsCount. Si omis, seatsCount doit valoir 1 (le passager est le client lui-même).",
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PassengerInputDto)
  passengers?: PassengerInputDto[];

  @ApiPropertyOptional({ description: 'Code promo à appliquer, s’il y en a un.' })
  @IsOptional()
  @IsString()
  promoCode?: string;
}