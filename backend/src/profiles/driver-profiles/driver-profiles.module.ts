// backend/src/profiles/driver-profiles/driver-profiles.module.ts
import { Module } from '@nestjs/common';
import { DriverProfilesController } from './driver-profiles.controller';
import { DriverProfilesService } from './driver-profiles.service';
import { DocumentsModule } from '../../documents/documents.module';
import { StorageModule } from '../../storage/storage.module';

@Module({
  imports: [DocumentsModule, StorageModule],
  controllers: [DriverProfilesController],
  providers: [DriverProfilesService],
  exports: [DriverProfilesService],
})
export class DriverProfilesModule {}
