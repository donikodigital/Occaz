// backend/src/platform-settings/platform-settings.controller.ts
import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { PlatformSettingsService } from './platform-settings.service';
import { UpsertPlatformSettingDto } from './dto/upsert-platform-setting.dto';

@ApiTags('Administration — Paramètres')
@ApiBearerAuth()
@Permissions(PERMISSIONS.SETTINGS_UPDATE)
@Controller('platform-settings')
export class PlatformSettingsController {
  constructor(private readonly platformSettingsService: PlatformSettingsService) {}

  @Get()
  findAll() {
    return this.platformSettingsService.findAll();
  }

  @Get(':key')
  findOne(@Param('key') key: string) {
    return this.platformSettingsService.findOne(key);
  }

  @Post()
  upsert(@Body() dto: UpsertPlatformSettingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.platformSettingsService.upsert(dto, user.id);
  }

  @Delete(':key')
  remove(@Param('key') key: string, @CurrentUser() user: AuthenticatedUser) {
    return this.platformSettingsService.remove(key, user.id);
  }
}
