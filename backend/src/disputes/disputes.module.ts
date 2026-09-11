// backend/src/disputes/disputes.module.ts
import { Module } from '@nestjs/common';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';
import { DocumentsModule } from '../documents/documents.module';
import { PaymentsModule } from '../payments/payments.module';
import { WalletsModule } from '../wallets/wallets.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [DocumentsModule, PaymentsModule, WalletsModule, UsersModule, NotificationsModule],
  controllers: [DisputesController],
  providers: [DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}
