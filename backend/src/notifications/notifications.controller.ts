// backend/src/notifications/notifications.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { NotificationsService } from './notifications.service';
import { DeleteNotificationsDto } from './dto/delete-notifications.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('mine')
  findMine(@Query() query: PaginationQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.findMine(user.id, query);
  }

  @Patch('mine/read-all')
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user.id);
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

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.remove(id, user.id);
  }
}