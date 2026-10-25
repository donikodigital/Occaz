// backend/src/accounting/accounting.module.ts
// [25/10/2026] v1 — Comptabilité. Exporte StaffPayService (fiches de paie) pour les retraits avec motif du portefeuille de la plateforme.
import { Module } from '@nestjs/common';
import { AccountingController } from './accounting.controller';
import { AccountingExportService } from './accounting-export.service';
import { AccountingService } from './accounting.service';
import { StaffPayService } from './staff-pay.service';

@Module({
  controllers: [AccountingController],
  providers: [AccountingService, AccountingExportService, StaffPayService],
  exports: [StaffPayService, AccountingService],
})
export class AccountingModule {}
