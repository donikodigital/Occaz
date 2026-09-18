// backend/src/geography/dto/create-region.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateRegionDto {
  @ApiProperty()
  @IsString()
  countryId!: string;

  @ApiProperty({ example: 'Région de Labé' })
  @IsString()
  name!: string;
}