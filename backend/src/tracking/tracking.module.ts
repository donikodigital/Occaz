// backend/src/tracking/tracking.module.ts
// [10/10/2026] v1 — suivi des colis (public par numéro, expéditeur, e-mails de statut).
import { Module } from '@nestjs/common';
import { EmailModule } from '../integrations/email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CustomerProfilesModule } from '../profiles/customer-profiles/customer-profiles.module';
import { TrackingController } from './tracking.controller';
import { TrackingNotificationsService } from './tracking-notifications.service';
import { TrackingService } from './tracking.service';

/**
 * Écoute les événements des envois et des trajets sans que Trajets ou Envois ne le connaissent (même principe que TicketsModule).
 */
@Module({
  imports: [EmailModule, NotificationsModule, CustomerProfilesModule],
  controllers: [TrackingController],
  providers: [TrackingService, TrackingNotificationsService],
  exports: [TrackingService],
})
export class TrackingModule {}
