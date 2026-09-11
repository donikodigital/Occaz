// backend/src/notifications/notifications.module.ts
import { Module } from '@nestjs/common';
import { NotificationTemplatesController } from './notification-templates.controller';
import { NotificationTemplatesService } from './notification-templates.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { SmsModule } from '../integrations/sms/sms.module';
import { PushModule } from '../integrations/push/push.module';
import { EmailModule } from '../integrations/email/email.module';

@Module({
  imports: [SmsModule, PushModule, EmailModule],
  controllers: [NotificationTemplatesController, NotificationsController],
  providers: [NotificationTemplatesService, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
