// backend/src/jobs/jobs.module.ts
// [19/10/2026] v1 — Déclencheur externe des traitements automatiques (voir jobs.controller.ts).
import { Module } from '@nestjs/common';
import { ShipmentsModule } from '../shipments/shipments.module';
import { TripsModule } from '../trips/trips.module';
import { OnboardingRemindersModule } from '../onboarding-reminders/onboarding-reminders.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
  imports: [TripsModule, ShipmentsModule, OnboardingRemindersModule],
  controllers: [JobsController],
  providers: [JobsService],
})
export class JobsModule {}
