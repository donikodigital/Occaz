// backend/src/platform-wallet/platform-wallet.module.ts
// [19/10/2026] v2 — WithdrawalCodeService (code de retrait envoyé par e-mail) : importe EmailModule.
import { Module } from '@nestjs/common';
import { EmailModule } from '../integrations/email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WalletsModule } from '../wallets/wallets.module';
import { PlatformWalletController } from './platform-wallet.controller';
import { PlatformWalletService } from './platform-wallet.service';
import { WithdrawalCodeService } from './withdrawal-code.service';

@Module({
  imports: [EmailModule, NotificationsModule, WalletsModule],
  controllers: [PlatformWalletController],
  providers: [PlatformWalletService, WithdrawalCodeService],
})
export class PlatformWalletModule {}
