// backend/src/tickets/tickets.controller.ts
// [10/10/2026] v1 — liens de téléchargement du billet (réservation) et des étiquettes (envoi), et téléchargement par lien signé.
import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { TicketsService } from './tickets.service';

@ApiTags('Billets et étiquettes')
@ApiBearerAuth()
@Controller('tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  /** Lien (valable 10 minutes) pour télécharger le billet PDF d'une réservation payée. */
  @Get('bookings/:id/link')
  bookingLink(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tickets.bookingDownloadLink(id, user);
  }

  /** Lien (valable 10 minutes) pour télécharger les étiquettes PDF — une page par colis — d'un envoi payé. */
  @Get('shipments/:id/link')
  shipmentLink(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tickets.shipmentDownloadLink(id, user);
  }

  /**
   * Ouvert par le navigateur ou la visionneuse PDF du téléphone, qui n'ont pas le jeton de connexion de l'application : le jeton du
   * lien (signé, limité à un document et à 10 minutes) tient lieu d'autorisation. La réponse est le PDF lui-même, hors de l'enveloppe
   * { success, data } des autres routes.
   */
  @Public()
  @Get('download/:token')
  async download(@Param('token') token: string, @Query('dl') dl: string | undefined, @Res() res: Response): Promise<void> {
    const file = await this.tickets.fileForToken(token);
    res
      .status(200)
      .set({
        'Content-Type': 'application/pdf',
        'Content-Length': String(file.buffer.length),
        // `?dl=1` (navigateur web de l'application) : téléchargement direct sans quitter la page. Sans lui : le PDF s'ouvre dans la visionneuse.
        'Content-Disposition': `${dl === '1' ? 'attachment' : 'inline'}; filename="${file.filename}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      })
      .end(file.buffer);
  }
}
