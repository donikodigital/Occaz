// backend/src/geocoding/geocoding.controller.ts
import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GEOCODING_PROVIDER, GeocodingProvider } from '../integrations/geocoding/geocoding-provider.interface';
import { SearchAddressDto } from './dto/search-address.dto';
import { ReverseGeocodeDto } from './dto/reverse-geocode.dto';

/**
 * Toujours authentifié (pas de @Public()) — protège le quota Mapbox
 * d'un usage comme proxy ouvert par des tiers non identifiés. Utilisé
 * par la recherche d'adresse pendant la création d'un trajet/envoi
 * (section 58, remplace la saisie 100% manuelle de Location).
 */
@ApiTags('Géocodage')
@ApiBearerAuth()
@Controller('geocoding')
export class GeocodingController {
  constructor(@Inject(GEOCODING_PROVIDER) private readonly geocodingProvider: GeocodingProvider) {}

  @Get('search')
  search(@Query() query: SearchAddressDto) {
    return this.geocodingProvider.search(query.query, query.countryCode);
  }

  @Get('reverse')
  reverse(@Query() query: ReverseGeocodeDto) {
    return this.geocodingProvider.reverseGeocode(query.latitude, query.longitude);
  }
}
