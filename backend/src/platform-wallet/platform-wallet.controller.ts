// backend/src/platform-wallet/platform-wallet.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { PlatformWalletService } from './platform-wallet.service';
import { ExpenseDocumentService } from './expense-document.service';
import {
  CreateBeneficiaryDto,
  CreateWithdrawalDto,
  FailWithdrawalDto,
  ListWithdrawalsQueryDto,
  PayslipPreviewQueryDto,
  RequestWithdrawalCodeDto,
  ResolveWithdrawalDto,
  UpdateBeneficiaryDto,
} from './dto/platform-wallet.dto';

@ApiTags('Portefeuille plateforme')
@ApiBearerAuth()
@Controller('platform-wallet')
export class PlatformWalletController {
  constructor(
    private readonly service: PlatformWalletService,
    private readonly documents: ExpenseDocumentService,
  ) {}

  /** Soldes par devise (XOF, GNF) : gagné, en attente, retiré, en cours, disponible. */
  @Permissions(PERMISSIONS.PLATFORM_WALLET_READ)
  @Get()
  overview() {
    return this.service.getOverview();
  }

  @Permissions(PERMISSIONS.PLATFORM_WALLET_READ)
  @Get('beneficiaries')
  beneficiaries() {
    return this.service.listBeneficiaries();
  }

  @Permissions(PERMISSIONS.PLATFORM_WALLET_MANAGE)
  @Post('beneficiaries')
  createBeneficiary(@Body() dto: CreateBeneficiaryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createBeneficiary(dto, user.id);
  }

  @Permissions(PERMISSIONS.PLATFORM_WALLET_MANAGE)
  @Patch('beneficiaries/:id')
  updateBeneficiary(@Param('id') id: string, @Body() dto: UpdateBeneficiaryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.updateBeneficiary(id, dto, user.id);
  }

  @Permissions(PERMISSIONS.PLATFORM_WALLET_READ)
  @Get('withdrawals')
  withdrawals(@Query() query: ListWithdrawalsQueryDto) {
    return this.service.listWithdrawals(query);
  }

  /**
   * Pièce comptable du retrait en PDF (bulletin de paie, reçu de prime, facture d'achat, note de frais, justificatif). La réponse est le PDF
   * lui-même, hors de l'enveloppe { success, data }. Bulletins et reçus de prime : réservés à ceux qui gèrent le portefeuille (vérifié au service).
   */
  @Permissions(PERMISSIONS.PLATFORM_WALLET_READ)
  @Get('withdrawals/:id/document')
  async document(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Res() res: Response): Promise<void> {
    const file = await this.documents.render(id, user);
    res
      .status(200)
      .set({
        'Content-Type': 'application/pdf',
        'Content-Length': String(file.buffer.length),
        'Content-Disposition': `attachment; filename="${file.filename}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      })
      .end(file.buffer);
  }

  /** Aperçu du bulletin d'une personne pour un mois : le net à payer remplit le montant du retrait « Salaire ». */
  @Permissions(PERMISSIONS.PLATFORM_WALLET_MANAGE)
  @Get('payslip-preview')
  payslipPreview(@Query() query: PayslipPreviewQueryDto) {
    return this.service.payslipPreview(query);
  }

  /** Étape 1 d'un retrait : envoie par e-mail le code de confirmation (valable 10 minutes, lié au bénéficiaire, à la devise et au montant). */
  @Permissions(PERMISSIONS.PLATFORM_WALLET_MANAGE)
  @Post('withdrawals/code')
  requestCode(@Body() dto: RequestWithdrawalCodeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.requestCode(dto, user.id);
  }

  @Permissions(PERMISSIONS.PLATFORM_WALLET_MANAGE)
  @Post('withdrawals')
  withdraw(@Body() dto: CreateWithdrawalDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.withdraw(dto, user.id);
  }

  @Permissions(PERMISSIONS.PLATFORM_WALLET_MANAGE)
  @Patch('withdrawals/:id/paid')
  markPaid(@Param('id') id: string, @Body() dto: ResolveWithdrawalDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.markPaid(id, dto.externalReference, user.id);
  }

  @Permissions(PERMISSIONS.PLATFORM_WALLET_MANAGE)
  @Patch('withdrawals/:id/failed')
  markFailed(@Param('id') id: string, @Body() dto: FailWithdrawalDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.markFailed(id, dto.reason, user.id);
  }
}
