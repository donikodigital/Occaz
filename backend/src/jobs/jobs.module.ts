// backend/src/jobs/jobs.module.ts
// [20/10/2026] v2 — + AccountPurgeModule (suppression des comptes suspendus depuis 6 mois).
// [19/10/2026] v1 — Déclencheur externe des traitements automatiques (voir jobs.controller.ts).
import { Module } from '@nestjs/common';
import { ShipmentsModule } from '../shipments/shipments.module';
import { TripsModule } from '../trips/trips.module';
import { OnboardingRemindersModule } from '../onboarding-reminders/onboarding-reminders.module';
import { AccountPurgeModule } from '../account-purge/account-purge.module';
import { WalletsModule } from '../wallets/wallets.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
  imports: [TripsModule, ShipmentsModule, OnboardingRemindersModule, AccountPurgeModule, WalletsModule],
  controllers: [JobsController],
  providers: [JobsService],
})
export class JobsModule {}
