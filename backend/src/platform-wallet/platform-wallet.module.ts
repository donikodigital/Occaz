// backend/src/platform-wallet/platform-wallet.module.ts
import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { WalletsModule } from '../wallets/wallets.module';
import { PlatformWalletController } from './platform-wallet.controller';
import { PlatformWalletService } from './platform-wallet.service';

@Module({
  imports: [NotificationsModule, WalletsModule],
  controllers: [PlatformWalletController],
  providers: [PlatformWalletService],
})
export class PlatformWalletModule {}
