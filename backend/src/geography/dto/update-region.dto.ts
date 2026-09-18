// backend/src/geography/dto/update-region.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateRegionDto } from './create-region.dto';

export class UpdateRegionDto extends PartialType(CreateRegionDto) {}