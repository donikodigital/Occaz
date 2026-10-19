// backend/src/account-roles/account-roles.module.ts
// [19/10/2026] v1 — Compte à deux profils (client + conducteur) et contrôles « pas de transaction avec soi-même ».
import { Module } from '@nestjs/common';
import { WalletsModule } from '../wallets/wallets.module';
import { AccountRolesController } from './account-roles.controller';
import { AccountRolesService } from './account-roles.service';
import { SelfDealingService } from './self-dealing.service';

@Module({
  imports: [WalletsModule],
  controllers: [AccountRolesController],
  providers: [AccountRolesService, SelfDealingService],
  exports: [AccountRolesService, SelfDealingService],
})
export class AccountRolesModule {}
