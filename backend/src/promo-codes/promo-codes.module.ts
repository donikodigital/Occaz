// backend/src/promo-codes/promo-codes.module.ts
import { Module } from '@nestjs/common';
import { PromoCodesController } from './promo-codes.controller';
import { PromoCodesService } from './promo-codes.service';
import { CustomerProfilesModule } from '../profiles/customer-profiles/customer-profiles.module';

@Module({
  imports: [CustomerProfilesModule],
  controllers: [PromoCodesController],
  providers: [PromoCodesService],
  exports: [PromoCodesService],
})
export class PromoCodesModule {}