// backend/src/pricing/exchange-rate.module.ts
import { Module } from '@nestjs/common';
import { ExchangeRateService } from './exchange-rate.service';

/**
 * Module isolé plutôt que d'ajouter ExchangeRateService à un module
 * pricing existant dont je n'ai pas le contenu actuel — évite tout
 * risque d'écraser des providers déjà déclarés que je ne connais pas.
 */
@Module({
  providers: [ExchangeRateService],
  exports: [ExchangeRateService],
})
export class ExchangeRateModule {}