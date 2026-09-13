// backend/src/integrations/geocoding/geocoding.module.ts
import { Module } from '@nestjs/common';
import { MapboxGeocodingProvider } from './mapbox-geocoding.provider';
import { GEOCODING_PROVIDER } from './geocoding-provider.interface';

/** Le choix du fournisseur effectif se fait ici — même principe que SmsModule. */
@Module({
  providers: [
    {
      provide: GEOCODING_PROVIDER,
      useClass: MapboxGeocodingProvider,
    },
  ],
  exports: [GEOCODING_PROVIDER],
})
export class GeocodingIntegrationModule {}
