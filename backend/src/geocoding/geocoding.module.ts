// backend/src/geocoding/geocoding.module.ts
import { Module } from '@nestjs/common';
import { GeocodingController } from './geocoding.controller';
import { GeocodingIntegrationModule } from '../integrations/geocoding/geocoding.module';

@Module({
  imports: [GeocodingIntegrationModule],
  controllers: [GeocodingController],
})
export class GeocodingModule {}
