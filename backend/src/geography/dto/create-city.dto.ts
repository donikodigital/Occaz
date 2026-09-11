// backend/src/geography/dto/create-city.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateCityDto {
  @ApiProperty()
  @IsString()
  countryId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  prefectureId?: string;

  @ApiProperty({ example: 'Labé' })
  @IsString()
  name: string;
}
