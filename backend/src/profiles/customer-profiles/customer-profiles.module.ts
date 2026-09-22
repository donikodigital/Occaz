// backend/src/profiles/customer-profiles/customer-profiles.module.ts
// [21/09/2026] v+ — StorageModule (photo de profil, comme côté chauffeur).
import { Module } from '@nestjs/common';
import { CustomerProfilesController } from './customer-profiles.controller';
import { CustomerProfilesService } from './customer-profiles.service';
import { NotificationsModule } from '../../notifications/notifications.module';
import { StorageModule } from '../../storage/storage.module';

@Module({
  imports: [NotificationsModule, StorageModule],
  controllers: [CustomerProfilesController],
  providers: [CustomerProfilesService],
  exports: [CustomerProfilesService],
})
export class CustomerProfilesModule {}