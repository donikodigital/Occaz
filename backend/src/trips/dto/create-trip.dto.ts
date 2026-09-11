// backend/src/trips/dto/create-trip.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { TripStopInputDto } from './trip-stop-input.dto';

export class CreateTripDto {
  @ApiProperty()
  @IsString()
  vehicleId: string;

  @ApiProperty()
  @IsString()
  originCityId: string;

  @ApiProperty({ description: 'Localisation précise du point de départ (voir POST /locations)' })
  @IsString()
  originLocationId: string;

  @ApiProperty()
  @IsString()
  destinationCityId: string;

  @ApiProperty({ description: "Localisation précise du point d'arrivée (voir POST /locations)" })
  @IsString()
  destinationLocationId: string;

  @ApiProperty({ example: '2026-09-20T08:00:00+00:00' })
  @IsDateString()
  departureAt: string;

  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(1)
  totalSeats: number;

  @ApiProperty({
    example: '50000',
    description: 'Prix par place, en plus petite unité de la devise (chaîne pour éviter toute perte de précision)',
  })
  @IsString()
  pricePerSeat: string;

  @ApiProperty()
  @IsString()
  currencyId: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  allowsLuggage?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  allowsShipments?: boolean;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxShipmentWeightKg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: [TripStopInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => TripStopInputDto)
  stops?: TripStopInputDto[];
}
