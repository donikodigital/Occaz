// backend/src/conversations/conversations.module.ts
import { Module } from '@nestjs/common';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { UserSafetyModule } from '../user-safety/user-safety.module';

@Module({
  imports: [NotificationsModule, UserSafetyModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}