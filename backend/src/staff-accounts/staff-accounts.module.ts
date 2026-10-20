// backend/src/staff-accounts/staff-accounts.module.ts
// [20/10/2026] v1 — Création des comptes d'équipe depuis le back-office (voir staff-accounts.service.ts).
import { Module } from '@nestjs/common';
import { EmailModule } from '../integrations/email/email.module';
import { StaffAccountsController } from './staff-accounts.controller';
import { StaffInvitationsController } from './staff-invitations.controller';
import { StaffAccountsService } from './staff-accounts.service';

@Module({
  imports: [EmailModule],
  controllers: [StaffAccountsController, StaffInvitationsController],
  providers: [StaffAccountsService],
})
export class StaffAccountsModule {}
