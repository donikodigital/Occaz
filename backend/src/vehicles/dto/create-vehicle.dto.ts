// backend/src/vehicles/dto/create-vehicle.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VehicleType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, IsUrl, Min } from 'class-validator';

export class CreateVehicleDto {
  @ApiProperty({ example: 'Toyota' })
  @IsString()
  brand: string;

  @ApiProperty({ example: 'Corolla' })
  @IsString()
  model: string;

  @ApiPropertyOptional({ example: 2018 })
  @IsOptional()
  @IsInt()
  @Min(1980)
  year?: number;

  @ApiPropertyOptional({ example: 'Gris' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({ example: 'RC-1234-GN' })
  @IsString()
  plateNumber: string;

  @ApiPropertyOptional({ enum: VehicleType, default: VehicleType.SEDAN })
  @IsOptional()
  @IsEnum(VehicleType)
  type?: VehicleType;

  @ApiProperty({ example: 4 })
  @IsInt()
  @Min(1)
  totalSeats: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  photoUrl?: string;
}
