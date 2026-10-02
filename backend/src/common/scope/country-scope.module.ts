// backend/src/common/scope/country-scope.module.ts
import { Global, Module } from '@nestjs/common';
import { CountryScopeService } from './country-scope.service';

/**
 * @Global() : le service de portée par pays s'injecte partout (contrôleurs et services) sans réimporter
 * ce module dans chaque feature module — même principe que PrismaModule.
 */
@Global()
@Module({
  providers: [CountryScopeService],
  exports: [CountryScopeService],
})
export class CountryScopeModule {}