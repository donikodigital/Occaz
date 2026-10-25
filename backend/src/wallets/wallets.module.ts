// backend/src/wallets/wallets.module.ts
// [25/10/2026] v+ — PayoutAutoReleaseService (envoi automatique des retraits programmés).
// [19/10/2026] v+ — PinConfirmationService exporté (confirmation par PIN de l'ouverture d'un second profil, voir AccountRolesService).
import { Module } from '@nestjs/common';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';
import { PayoutsController } from './payouts.controller';
import { PayoutsService } from './payouts.service';
import { DriverProfilesModule } from '../profiles/driver-profiles/driver-profiles.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ExchangeRateModule } from '../pricing/exchange-rate.module';
import { SimulatedPayoutProvider } from './providers/simulated-payout.provider';
import { PayoutProviderRegistry } from './providers/payout-provider.registry';
import { PinConfirmationService } from './pin-confirmation.service';
import { PayoutGuardrailsService } from './payout-guardrails.service';
import { PayoutAutoReleaseService } from './payout-auto-release.service';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [DriverProfilesModule, NotificationsModule, ExchangeRateModule, PricingModule],
  controllers: [WalletsController, PayoutsController],
  providers: [WalletsService, PayoutsService, SimulatedPayoutProvider, PayoutProviderRegistry, PinConfirmationService, PayoutGuardrailsService, PayoutAutoReleaseService],
  exports: [WalletsService, PayoutsService, PayoutProviderRegistry, PinConfirmationService, PayoutAutoReleaseService],
})
export class WalletsModule {}