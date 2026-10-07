// backend/src/trip-pricing/trip-pricing.module.ts
import { Module } from '@nestjs/common';
import { PricingModule } from '../pricing/pricing.module';
import { TripPricingController } from './trip-pricing.controller';
import { TripPricingService } from './trip-pricing.service';

@Module({
  imports: [PricingModule],
  controllers: [TripPricingController],
  providers: [TripPricingService],
  exports: [TripPricingService],
})
export class TripPricingModule {}
