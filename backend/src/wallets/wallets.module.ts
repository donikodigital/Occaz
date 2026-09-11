// backend/src/wallets/wallets.module.ts
import { Module } from '@nestjs/common';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';
import { PayoutsController } from './payouts.controller';
import { PayoutsService } from './payouts.service';
import { DriverProfilesModule } from '../profiles/driver-profiles/driver-profiles.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [DriverProfilesModule, NotificationsModule],
  controllers: [WalletsController, PayoutsController],
  providers: [WalletsService, PayoutsService],
  exports: [WalletsService, PayoutsService],
})
export class WalletsModule {}
