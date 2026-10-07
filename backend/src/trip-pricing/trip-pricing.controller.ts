// backend/src/trip-pricing/trip-pricing.controller.ts
import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { TripPricingService } from './trip-pricing.service';
import { SaveTripPricingConfigDto } from './dto/save-trip-pricing-config.dto';
import { PriceGuidanceQueryDto } from './dto/price-guidance-query.dto';

@ApiTags('Prix des trajets')
@ApiBearerAuth()
@Controller('trip-pricing')
export class TripPricingController {
  constructor(private readonly tripPricing: TripPricingService) {}

  /** Page « Configuration frais trajets » : mode et paliers de chaque devise. Réservé à la permission des réglages (SuperAdmin). */
  @Permissions(PERMISSIONS.SETTINGS_UPDATE)
  @Get('config')
  getConfig() {
    return this.tripPricing.getConfig();
  }

  @Permissions(PERMISSIONS.SETTINGS_UPDATE)
  @Put('config')
  saveConfig(@Body() dto: SaveTripPricingConfigDto, @CurrentUser() user: AuthenticatedUser) {
    return this.tripPricing.saveConfig(dto, user.id);
  }

  /**
   * Pour l'écran « Créer un trajet » du conducteur : mode en vigueur, prix conseillé et bornes pour ce départ / cette arrivée.
   * Ouvert à tout compte connecté (comme la création d'un trajet) ; ne renvoie aucune donnée de configuration détaillée.
   */
  @Get('guidance')
  guidance(@Query() query: PriceGuidanceQueryDto) {
    return this.tripPricing.guidance(query);
  }
}
