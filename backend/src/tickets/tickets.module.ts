// backend/src/tickets/tickets.module.ts
// [10/10/2026] v1 — billets de voyage et étiquettes de colis (PDF A5).
import { Module } from '@nestjs/common';
import { EmailModule } from '../integrations/email/email.module';
import { CustomerProfilesModule } from '../profiles/customer-profiles/customer-profiles.module';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

/**
 * Écoute les événements « paiement confirmé » (BOOKING_PAID, SHIPMENT_PAID) sans que Trajets, Envois ou Paiements ne le connaissent :
 * même principe que ShipmentDispatchService.
 */
@Module({
  imports: [EmailModule, CustomerProfilesModule],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
