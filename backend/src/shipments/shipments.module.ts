// backend/src/shipments/shipments.module.ts
// [19/10/2026] v7 — AccountRolesModule (SelfDealingService : pas de transport de son propre envoi).
// [19/10/2026] v6 — photos du colis (ShipmentPhotosService, ShipmentPhotosController, StorageModule).
// [19/10/2026] v5 — ShipmentAccessService (accès aux preuves d'un envoi).
// [09/10/2026] v4 — ShipmentInvitationsService (le client invite des conducteurs).
// [23/09/2026] v3 — PromoCodesModule (code promo à la création d'un envoi).
// [21/09/2026] v2 — ShipmentDispatchService et ShipmentWindowService.
import { Module } from '@nestjs/common';
import { ShipmentsController } from './shipments.controller';
import { ShipmentsService } from './shipments.service';
import { ShipmentOtpService } from './shipment-otp.service';
import { ShipmentDispatchService } from './shipment-dispatch.service';
import { ShipmentWindowService } from './shipment-window.service';
import { ShipmentAccessService } from './shipment-access.service';
import { ShipmentPhotosService } from './shipment-photos.service';
import { ShipmentPhotosController } from './shipment-photos.controller';
import { StorageModule } from '../storage/storage.module';
import { AccountRolesModule } from '../account-roles/account-roles.module';
import { ShipmentInvitationsService } from './shipment-invitations.service';
import { ShipmentCategoriesModule } from '../shipment-categories/shipment-categories.module';
import { DocumentsModule } from '../documents/documents.module';
import { PricingModule } from '../pricing/pricing.module';
import { CustomerProfilesModule } from '../profiles/customer-profiles/customer-profiles.module';
import { DriverProfilesModule } from '../profiles/driver-profiles/driver-profiles.module';
import { WalletsModule } from '../wallets/wallets.module';
import { OtpModule } from '../otp/otp.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PromoCodesModule } from '../promo-codes/promo-codes.module';

import { UserSafetyModule } from '../user-safety/user-safety.module';

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
    PromoCodesModule,
    UserSafetyModule,
    StorageModule,
    AccountRolesModule,
  ],
  controllers: [ShipmentsController, ShipmentPhotosController],
  providers: [ShipmentsService, ShipmentOtpService, ShipmentDispatchService, ShipmentWindowService, ShipmentInvitationsService, ShipmentAccessService, ShipmentPhotosService],
  exports: [ShipmentsService, ShipmentOtpService, ShipmentWindowService],
})
export class ShipmentsModule {}