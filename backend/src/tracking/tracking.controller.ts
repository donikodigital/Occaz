// backend/src/tracking/tracking.controller.ts
// [10/10/2026] v1 — Suivi d'un colis : public par numéro, ou connecté (expéditeur / support) par identifiant d'envoi.
import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { TrackingService } from './tracking.service';

@ApiTags('Suivi des colis')
@Controller('tracking')
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  /**
   * Suivi ouvert à toute personne qui a le numéro (OCZ…), sans compte : le destinataire, un proche, le point relais. Position
   * arrondie à ~5 km, aucun nom ni téléphone. Limité à 30 appels par minute et par adresse pour empêcher d'essayer des numéros.
   */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('public/:number')
  findPublic(@Param('number') number: string) {
    return this.tracking.findPublic(number);
  }

  /** Suivi de l'expéditeur (ou du support dans son périmètre) : même contenu, position exacte. */
  @ApiBearerAuth()
  @Get('shipments/:id')
  findForUser(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tracking.findForUser(id, user);
  }
}
