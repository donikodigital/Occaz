// backend/src/profiles/driver-profiles/driver-profiles.module.ts
// [19/10/2026] v2 — DriverComplianceService (régularisation du dossier : délai de tolérance, trajets autorisés ou bloqués).
import { Module } from '@nestjs/common';
import { DriverProfilesController } from './driver-profiles.controller';
import { DriverProfilesService } from './driver-profiles.service';
import { DriverComplianceService } from './driver-compliance.service';
import { DocumentsModule } from '../../documents/documents.module';
import { StorageModule } from '../../storage/storage.module';
import { NotificationsModule } from '../../notifications/notifications.module';

@Module({
  imports: [DocumentsModule, StorageModule, NotificationsModule],
  controllers: [DriverProfilesController],
  providers: [DriverProfilesService, DriverComplianceService],
  exports: [DriverProfilesService, DriverComplianceService],
})
export class DriverProfilesModule {}
