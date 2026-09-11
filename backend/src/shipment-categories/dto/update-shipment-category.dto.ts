// backend/src/shipment-categories/dto/update-shipment-category.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateShipmentCategoryDto } from './create-shipment-category.dto';

export class UpdateShipmentCategoryDto extends PartialType(CreateShipmentCategoryDto) {}
