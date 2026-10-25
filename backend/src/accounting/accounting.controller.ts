// backend/src/accounting/accounting.controller.ts
// [25/10/2026] v1 — Comptabilité : synthèse annuelle (mois / semestres / année), exports Excel et PDF, personnel et fiches de paie.
// Lecture : PLATFORM_WALLET_READ. Personnel et fiches de paie (données personnelles et salaires) : PLATFORM_WALLET_MANAGE.
import { Body, Controller, Get, Param, Put, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { AccountingService } from './accounting.service';
import { AccountingExportService } from './accounting-export.service';
import { StaffPayService } from './staff-pay.service';
import { AccountingQueryDto } from './dto/accounting-query.dto';
import { UpsertStaffPayProfileDto } from './dto/staff-pay.dto';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function canSeeStaffNames(user: AuthenticatedUser): boolean {
  return user.accountType === AccountType.SUPERADMIN || user.permissions.includes(PERMISSIONS.PLATFORM_WALLET_MANAGE);
}

function sendFile(res: Response, buffer: Buffer, contentType: string, filename: string): void {
  res
    .status(200)
    .set({
      'Content-Type': contentType,
      'Content-Length': String(buffer.length),
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    })
    .end(buffer);
}

@ApiTags('Comptabilité')
@ApiBearerAuth()
@Controller('accounting')
export class AccountingController {
  constructor(
    private readonly accounting: AccountingService,
    private readonly exports: AccountingExportService,
    private readonly staffPay: StaffPayService,
  ) {}

  /** Commissions, versements aux conducteurs et dépenses de l'administration : par mois, semestre et année, devise par devise. */
  @Permissions(PERMISSIONS.PLATFORM_WALLET_READ)
  @Get('summary')
  summary(@Query() query: AccountingQueryDto) {
    return this.accounting.summary(query.year);
  }

  @Permissions(PERMISSIONS.PLATFORM_WALLET_READ)
  @Get('export/excel')
  async exportExcel(@Query() query: AccountingQueryDto, @CurrentUser() user: AuthenticatedUser, @Res() res: Response): Promise<void> {
    const year = query.year ?? new Date().getUTCFullYear();
    sendFile(res, await this.exports.excel(year, canSeeStaffNames(user)), XLSX_TYPE, `comptabilite-${year}.xlsx`);
  }

  @Permissions(PERMISSIONS.PLATFORM_WALLET_READ)
  @Get('export/pdf')
  async exportPdf(@Query() query: AccountingQueryDto, @Res() res: Response): Promise<void> {
    const year = query.year ?? new Date().getUTCFullYear();
    sendFile(res, await this.exports.pdf(year), 'application/pdf', `comptabilite-${year}.pdf`);
  }

  /** Le personnel de l'administration et l'état de sa fiche de paie. */
  @Permissions(PERMISSIONS.PLATFORM_WALLET_MANAGE)
  @Get('staff')
  staff() {
    return this.staffPay.listStaff();
  }

  /** Crée ou remplace la fiche de paie d'une personne (matricule, emploi, embauche, salaire de base, primes, retenues). */
  @Permissions(PERMISSIONS.PLATFORM_WALLET_MANAGE)
  @Put('staff/:userId/pay-profile')
  upsertPayProfile(@Param('userId') userId: string, @Body() dto: UpsertStaffPayProfileDto, @CurrentUser() user: AuthenticatedUser) {
    return this.staffPay.upsertPayProfile(userId, dto, user.id);
  }
}
