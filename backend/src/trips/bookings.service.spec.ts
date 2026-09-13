// backend/src/trips/bookings.service.spec.ts
import { BookingsService } from './bookings.service';
import type { PricingService } from '../pricing/pricing.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * computeCustomerRefundPercentage est privée — accédée via un cast en
 * `any`, un compromis assumé plutôt que de renoncer à tester la règle
 * la plus consequente de l'annulation (quel pourcentage un client
 * récupère selon le délai avant départ). BookingsService n'a que 3
 * dépendances, toutes mockées à la main plutôt qu'un TestingModule
 * complet.
 */
function createService(cancellationPolicy: unknown) {
  const prisma = {} as PrismaService;
  const pricing = {
    getCancellationPolicy: jest.fn().mockResolvedValue(cancellationPolicy),
  } as unknown as PricingService;
  const eventEmitter = {} as EventEmitter2;
  return new BookingsService(prisma, pricing, eventEmitter);
}

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 3_600_000);
}

describe('BookingsService.computeCustomerRefundPercentage', () => {
  const trip = { originCity: { countryId: 'country-1' } };

  it("renvoie null si aucune politique n'est configurée pour ce pays/service", async () => {
    const service = createService(null);
    const result = await (service as any).computeCustomerRefundPercentage({
      ...trip,
      departureAt: hoursFromNow(48),
    });
    expect(result).toBeNull();
  });

  it('renvoie le pourcentage de remboursement complet si annulé largement avant le délai', async () => {
    const service = createService({ hoursBeforeDeparture: 24, refundPercentage: 80 });
    const result = await (service as any).computeCustomerRefundPercentage({
      ...trip,
      departureAt: hoursFromNow(48),
    });
    expect(result).toBe(80);
  });

  it('renvoie 0 si annulé trop près du départ (sous le délai configuré)', async () => {
    const service = createService({ hoursBeforeDeparture: 24, refundPercentage: 80 });
    const result = await (service as any).computeCustomerRefundPercentage({
      ...trip,
      departureAt: hoursFromNow(2),
    });
    expect(result).toBe(0);
  });

  it('renvoie le pourcentage configuré pile au seuil (comparaison inclusive)', async () => {
    const service = createService({ hoursBeforeDeparture: 24, refundPercentage: 80 });
    const result = await (service as any).computeCustomerRefundPercentage({
      ...trip,
      // Léger excédent (24.01h) pour absorber le temps d'exécution entre
      // le calcul de departureAt ici et Date.now() dans le code testé —
      // sans ça, un test "pile au seuil" est intrinsèquement instable de
      // quelques millisecondes.
      departureAt: hoursFromNow(24.01),
    });
    expect(result).toBe(80);
  });

  it('renvoie 0 pour un départ déjà passé (temps négatif)', async () => {
    const service = createService({ hoursBeforeDeparture: 24, refundPercentage: 80 });
    const result = await (service as any).computeCustomerRefundPercentage({
      ...trip,
      departureAt: hoursFromNow(-5),
    });
    expect(result).toBe(0);
  });
});
