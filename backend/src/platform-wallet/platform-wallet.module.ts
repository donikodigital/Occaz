// backend/src/platform-wallet/platform-wallet.module.ts
// [25/10/2026] v3 — motifs de retrait : pièces PDF (ExpenseDocumentService) et fiches de paie du personnel (AccountingModule).
// [19/10/2026] v2 — WithdrawalCodeService (code de retrait envoyé par e-mail) : importe EmailModule.
import { Module } from '@nestjs/common';
import { AccountingModule } from '../accounting/accounting.module';
import { EmailModule } from '../integrations/email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WalletsModule } from '../wallets/wallets.module';
import { ExpenseDocumentService } from './expense-document.service';
import { PlatformWalletController } from './platform-wallet.controller';
import { PlatformWalletService } from './platform-wallet.service';
import { WithdrawalCodeService } from './withdrawal-code.service';

@Module({
  imports: [AccountingModule, EmailModule, NotificationsModule, WalletsModule],
  controllers: [PlatformWalletController],
  providers: [PlatformWalletService, WithdrawalCodeService, ExpenseDocumentService],
})
export class PlatformWalletModule {}
