// backend/src/geography/geography.module.ts
import { Module } from '@nestjs/common';
import { CountriesController } from './countries.controller';
import { CountriesService } from './countries.service';
import { CurrenciesController } from './currencies.controller';
import { CurrenciesService } from './currencies.service';
import { RegionsController } from './regions.controller';
import { RegionsService } from './regions.service';
import { PrefecturesController } from './prefectures.controller';
import { PrefecturesService } from './prefectures.service';
import { CitiesController } from './cities.controller';
import { CitiesService } from './cities.service';

@Module({
  controllers: [
    CountriesController,
    CurrenciesController,
    RegionsController,
    PrefecturesController,
    CitiesController,
  ],
  providers: [
    CountriesService,
    CurrenciesService,
    RegionsService,
    PrefecturesService,
    CitiesService,
  ],
  exports: [CountriesService, CurrenciesService, RegionsService, PrefecturesService, CitiesService],
})
export class GeographyModule {}
