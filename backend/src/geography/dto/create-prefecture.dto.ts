// backend/src/geography/dto/create-prefecture.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreatePrefectureDto {
  @ApiProperty()
  @IsString()
  regionId!: string;

  @ApiProperty({ example: 'Préfecture de Labé' })
  @IsString()
  name!: string;
}