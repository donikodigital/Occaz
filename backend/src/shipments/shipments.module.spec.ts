// backend/src/shipments/shipments.module.spec.ts
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { AuditModule } from '../audit/audit.module';
import { DOMAIN_EVENTS, ShipmentSearchOpenedEvent } from '../common/events/domain-events';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { ShipmentDispatchService } from './shipment-dispatch.service';
import { ShipmentWindowService } from './shipment-window.service';
import { ShipmentsModule } from './shipments.module';
import { ShipmentsService } from './shipments.service';

/**
 * Câblage du module Envois : tous les services se résolvent (sans quoi
 * l'application ne démarre pas) et l'événement « recherche de chauffeur
 * ouverte » — émis à la confirmation du paiement et à la prolongation —
 * déclenche bien l'annonce aux chauffeurs.
 */
describe('ShipmentsModule', () => {
  const previousJobSetting = process.env.SHIPMENT_WINDOW_JOB;

  beforeAll(() => {
    // Pas de minuteur pendant le test.
    process.env.SHIPMENT_WINDOW_JOB = 'off';
  });

  afterAll(() => {
    if (previousJobSetting === undefined) delete process.env.SHIPMENT_WINDOW_JOB;
    else process.env.SHIPMENT_WINDOW_JOB = previousJobSetting;
  });

  async function buildModule() {
    return Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), EventEmitterModule.forRoot(), PrismaModule, AuditModule, ShipmentsModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
  }

  it('résout tous les services, y compris l\'annonce aux chauffeurs et la tâche de fin de plage', async () => {
    const moduleRef = await buildModule();
    expect(moduleRef.get(ShipmentsService)).toBeDefined();
    expect(moduleRef.get(ShipmentDispatchService)).toBeDefined();
    expect(moduleRef.get(ShipmentWindowService)).toBeDefined();
  });

  it('annonce l\'envoi aux chauffeurs quand la recherche de chauffeur s\'ouvre', async () => {
    const moduleRef = await buildModule();
    const dispatch = jest.spyOn(moduleRef.get(ShipmentDispatchService), 'dispatch').mockResolvedValue(0);
    await moduleRef.init();

    moduleRef.get(EventEmitter2).emit(DOMAIN_EVENTS.SHIPMENT_SEARCH_OPENED, new ShipmentSearchOpenedEvent('s1'));
    // Écouteur asynchrone : on laisse passer un tour de boucle d'événements.
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(dispatch).toHaveBeenCalledWith('s1');
    await moduleRef.close();
  });
});