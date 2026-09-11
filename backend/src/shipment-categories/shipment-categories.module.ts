// backend/src/shipment-categories/shipment-categories.module.ts
import { Module } from '@nestjs/common';
import { ShipmentCategoriesController } from './shipment-categories.controller';
import { ShipmentCategoriesService } from './shipment-categories.service';

@Module({
  controllers: [ShipmentCategoriesController],
  providers: [ShipmentCategoriesService],
  exports: [ShipmentCategoriesService],
})
export class ShipmentCategoriesModule {}
