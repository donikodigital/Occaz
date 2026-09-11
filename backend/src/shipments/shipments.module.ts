// backend/src/shipments/shipments.module.ts
import { Module } from '@nestjs/common';
import { ShipmentsController } from './shipments.controller';
import { ShipmentsService } from './shipments.service';
import { ShipmentOtpService } from './shipment-otp.service';
import { ShipmentCategoriesModule } from '../shipment-categories/shipment-categories.module';
import { DocumentsModule } from '../documents/documents.module';
import { PricingModule } from '../pricing/pricing.module';
import { CustomerProfilesModule } from '../profiles/customer-profiles/customer-profiles.module';
import { DriverProfilesModule } from '../profiles/driver-profiles/driver-profiles.module';
import { WalletsModule } from '../wallets/wallets.module';
import { OtpModule } from '../otp/otp.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    ShipmentCategoriesModule,
    DocumentsModule,
    PricingModule,
    CustomerProfilesModule,
    DriverProfilesModule,
    WalletsModule,
    OtpModule,
    NotificationsModule,
  ],
  controllers: [ShipmentsController],
  providers: [ShipmentsService, ShipmentOtpService],
  exports: [ShipmentsService, ShipmentOtpService],
})
export class ShipmentsModule {}
