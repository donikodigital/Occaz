// backend/src/account-purge/account-purge.module.ts
// [20/10/2026] v1 — Suppression définitive des comptes suspendus depuis 6 mois (rappels mensuels par e-mail avant), lancée par JobsService.
import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';
import { SuspendedAccountPurgeService } from './suspended-account-purge.service';

@Module({
  imports: [NotificationsModule, StorageModule],
  providers: [SuspendedAccountPurgeService],
  exports: [SuspendedAccountPurgeService],
})
export class AccountPurgeModule {}
