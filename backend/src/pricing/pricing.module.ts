// backend/src/pricing/pricing.module.ts
import { Module } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { CommissionRulesController } from './commission-rules.controller';
import { CommissionRulesService } from './commission-rules.service';
import { CancellationPoliciesController } from './cancellation-policies.controller';
import { CancellationPoliciesService } from './cancellation-policies.service';

@Module({
  controllers: [CommissionRulesController, CancellationPoliciesController],
  providers: [PricingService, CommissionRulesService, CancellationPoliciesService],
  exports: [PricingService, CommissionRulesService, CancellationPoliciesService],
})
export class PricingModule {}
