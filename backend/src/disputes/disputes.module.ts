// backend/src/disputes/disputes.module.ts
import { Module } from '@nestjs/common';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';
import { DocumentsModule } from '../documents/documents.module';
import { PaymentsModule } from '../payments/payments.module';
import { WalletsModule } from '../wallets/wallets.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TripsModule } from '../trips/trips.module';
import { ShipmentsModule } from '../shipments/shipments.module';

@Module({
  imports: [
    DocumentsModule,
    PaymentsModule,
    WalletsModule,
    UsersModule,
    NotificationsModule,
    TripsModule,
    ShipmentsModule,
  ],
  controllers: [DisputesController],
  providers: [DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}