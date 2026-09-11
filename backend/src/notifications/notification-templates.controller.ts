// backend/src/notifications/notification-templates.controller.ts
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { NotificationTemplatesService } from './notification-templates.service';
import { CreateNotificationTemplateDto } from './dto/create-notification-template.dto';
import { UpdateNotificationTemplateDto } from './dto/update-notification-template.dto';

@ApiTags('Notifications — Modèles')
@ApiBearerAuth()
@Permissions(PERMISSIONS.NOTIFICATION_TEMPLATE_MANAGE)
@Controller('notification-templates')
export class NotificationTemplatesController {
  constructor(private readonly templatesService: NotificationTemplatesService) {}

  @Get()
  findAll() {
    return this.templatesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.templatesService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateNotificationTemplateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.templatesService.create(dto, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateNotificationTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.templatesService.update(id, dto, user.id);
  }
}
