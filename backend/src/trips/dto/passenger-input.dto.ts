// backend/src/trips/dto/passenger-input.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class PassengerInputDto {
  @ApiProperty({ example: 'Aïssatou Bah' })
  @IsString()
  fullName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;
}