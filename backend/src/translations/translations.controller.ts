// backend/src/translations/translations.controller.ts
import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Public } from '../common/decorators/public.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { TranslationsService } from './translations.service';
import { UpsertTranslationDto } from './dto/upsert-translation.dto';

@ApiTags('Administration — Traductions')
@ApiBearerAuth()
@Controller('translations')
export class TranslationsController {
  constructor(private readonly translationsService: TranslationsService) {}

  @Public()
  @Get('for-entity')
  findForEntity(
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
    @Query('locale') locale?: string,
  ) {
    return this.translationsService.findForEntity(entityType, entityId, locale);
  }

  @Permissions(PERMISSIONS.SETTINGS_UPDATE)
  @Get()
  findAll(
    @Query() query: PaginationQueryDto,
    @Query('entityType') entityType?: string,
    @Query('locale') locale?: string,
  ) {
    return this.translationsService.findAll(query, { entityType, locale });
  }

  @Permissions(PERMISSIONS.SETTINGS_UPDATE)
  @Post()
  upsert(@Body() dto: UpsertTranslationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.translationsService.upsert(dto, user.id);
  }

  @Permissions(PERMISSIONS.SETTINGS_UPDATE)
  @Delete()
  remove(
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
    @Query('locale') locale: string,
    @Query('field') field: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.translationsService.remove(entityType, entityId, locale, field, user.id);
  }
}
