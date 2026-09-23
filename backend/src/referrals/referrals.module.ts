// backend/src/referrals/referrals.module.ts
// [23/09/2026] v2 — PricingModule (lecture du montant de récompense par défaut) ; exporté pour PaymentsModule.
import { Module } from '@nestjs/common';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';
import { WalletsModule } from '../wallets/wallets.module';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [WalletsModule, PricingModule],
  controllers: [ReferralsController],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}