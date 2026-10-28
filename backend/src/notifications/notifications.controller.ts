// backend/src/notifications/notifications.controller.ts
// [28/10/2026] v+ — ?space=CUSTOMER|DRIVER sur la liste, le compteur, « tout lire » et « tout vider » (une personne peut être client ET conducteur).
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { NotificationsService } from './notifications.service';
import { DeleteNotificationsDto } from './dto/delete-notifications.dto';
import { ListNotificationsQueryDto, NotificationSpaceQueryDto } from './dto/notification-space.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('mine')
  findMine(@Query() query: ListNotificationsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.findMine(user.id, query, query.space);
  }

  /** Pastille de la cloche : nombre de notifications non lues. */
  @Get('mine/unread-count')
  unreadCount(@Query() query: NotificationSpaceQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.unreadCount(user.id, query.space);
  }

  @Patch('mine/read-all')
  markAllRead(@Query() query: NotificationSpaceQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user.id, query.space);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markRead(id, user.id);
  }

  // POST plutôt que DELETE + corps de requête : un corps sur DELETE est
  // parfois perdu en route par un proxy/client intermédiaire.
  @Post('mine/delete-many')
  removeMany(@Body() dto: DeleteNotificationsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.removeMany(dto.ids, user.id);
  }

  /** Vide toute la boîte de réception. */
  @Post('mine/delete-all')
  removeAll(@Query() query: NotificationSpaceQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.removeAll(user.id, query.space);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.remove(id, user.id);
  }
}