// backend/src/wallets/wallets.module.ts
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

@Module({
  imports: [DriverProfilesModule, NotificationsModule, ExchangeRateModule],
  controllers: [WalletsController, PayoutsController],
  providers: [WalletsService, PayoutsService, SimulatedPayoutProvider, PayoutProviderRegistry, PinConfirmationService, PayoutGuardrailsService],
  exports: [WalletsService, PayoutsService, PayoutProviderRegistry, PinConfirmationService],
})
export class WalletsModule {}