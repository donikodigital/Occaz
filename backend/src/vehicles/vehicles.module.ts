// backend/src/vehicles/vehicles.module.ts
import { Module } from '@nestjs/common';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { DocumentsModule } from '../documents/documents.module';
import { DriverProfilesModule } from '../profiles/driver-profiles/driver-profiles.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [DocumentsModule, DriverProfilesModule, StorageModule],
  controllers: [VehiclesController],
  providers: [VehiclesService],
  exports: [VehiclesService],
})
export class VehiclesModule {}
