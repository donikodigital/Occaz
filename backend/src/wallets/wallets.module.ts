// backend/src/wallets/wallets.module.ts
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

@Module({
  imports: [DriverProfilesModule, NotificationsModule, ExchangeRateModule],
  controllers: [WalletsController, PayoutsController],
  providers: [WalletsService, PayoutsService, SimulatedPayoutProvider, PayoutProviderRegistry],
  exports: [WalletsService, PayoutsService, PayoutProviderRegistry],
})
export class WalletsModule {}