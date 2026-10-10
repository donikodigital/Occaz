// backend/src/user-safety/user-safety.module.ts
// [11/10/2026] v1 — blocage, signalement, contacts d'urgence, SOS. Exporte UserBlocksService : les contrôleurs des réservations, des
// envois et de la messagerie s'en servent pour refuser une action entre deux comptes dont l'un a bloqué l'autre.
import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { SmsModule } from '../integrations/sms/sms.module';
import { UserBlocksService } from './user-blocks.service';
import { UserReportsService } from './user-reports.service';
import { EmergencyContactsService } from './emergency-contacts.service';
import { SosService } from './sos.service';
import { EmergencyContactsController, SosController, UserBlocksController, UserReportsController } from './user-safety.controllers';

@Module({
  imports: [NotificationsModule, SmsModule],
  controllers: [UserBlocksController, UserReportsController, EmergencyContactsController, SosController],
  providers: [UserBlocksService, UserReportsService, EmergencyContactsService, SosService],
  exports: [UserBlocksService],
})
export class UserSafetyModule {}
