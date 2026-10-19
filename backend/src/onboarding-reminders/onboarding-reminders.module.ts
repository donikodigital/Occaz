// backend/src/onboarding-reminders/onboarding-reminders.module.ts
// [19/10/2026] v1 — Rappels automatiques d'intégration (dossier conducteur, adresse e-mail), lancés par JobsService.
import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { DriverProfilesModule } from '../profiles/driver-profiles/driver-profiles.module';
import { OnboardingReminderService } from './onboarding-reminder.service';

@Module({
  imports: [NotificationsModule, DriverProfilesModule],
  providers: [OnboardingReminderService],
  exports: [OnboardingReminderService],
})
export class OnboardingRemindersModule {}
