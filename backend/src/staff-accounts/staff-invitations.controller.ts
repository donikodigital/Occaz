// backend/src/staff-accounts/staff-invitations.controller.ts
// [20/10/2026] v1 — Routes publiques du lien reçu par e-mail : le jeton du lien est le seul secret (256 bits, usage unique, 7 jours).
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { StaffAccountsService } from './staff-accounts.service';
import { AcceptInvitationDto, InspectInvitationDto } from './dto/staff-invitation.dto';

@ApiTags('Comptes d\'équipe — invitation')
@Controller('staff-invitations')
export class StaffInvitationsController {
  constructor(private readonly staffAccounts: StaffAccountsService) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('inspect')
  inspect(@Body() dto: InspectInvitationDto) {
    return this.staffAccounts.inspectInvitation(dto.token);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('accept')
  accept(@Body() dto: AcceptInvitationDto) {
    return this.staffAccounts.acceptInvitation(dto.token, dto.newPassword);
  }
}
