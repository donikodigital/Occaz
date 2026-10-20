// backend/src/staff-accounts/staff-accounts.controller.ts
// [20/10/2026] v1 — Comptes d'équipe : liste, création, renvoi de l'invitation. Réservé au SuperAdmin (contrôlé dans le service).
import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { StaffAccountsService } from './staff-accounts.service';
import { CreateStaffAccountDto } from './dto/create-staff-account.dto';

@ApiTags('Comptes d\'équipe')
@ApiBearerAuth()
@Controller('staff-accounts')
export class StaffAccountsController {
  constructor(private readonly staffAccounts: StaffAccountsService) {}

  @Get()
  list(@CurrentUser() actor: AuthenticatedUser) {
    return this.staffAccounts.list(actor);
  }

  @Post()
  create(@Body() dto: CreateStaffAccountDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.staffAccounts.create(dto, actor);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/resend-invitation')
  resend(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.staffAccounts.resendInvitation(id, actor);
  }
}
