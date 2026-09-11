// backend/src/verifications/verifications.module.ts
import { Module } from '@nestjs/common';
import { VerificationsController } from './verifications.controller';
import { VerificationsService } from './verifications.service';
import { DriverProfilesModule } from '../profiles/driver-profiles/driver-profiles.module';

@Module({
  imports: [DriverProfilesModule],
  controllers: [VerificationsController],
  providers: [VerificationsService],
  exports: [VerificationsService],
})
export class VerificationsModule {}
