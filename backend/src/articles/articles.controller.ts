// backend/src/articles/articles.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ArticlesService } from './articles.service';
import { UpsertArticleDto } from './dto/upsert-article.dto';

@ApiTags('Actualités')
@ApiBearerAuth()
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Get('published')
  findPublished(@Query() query: PaginationQueryDto, @Query('countryId') countryId?: string) {
    return this.articlesService.findPublished(query, countryId);
  }

  @Permissions(PERMISSIONS.PROMOTION_MANAGE)
  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.articlesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.articlesService.findOne(id);
  }

  @Permissions(PERMISSIONS.PROMOTION_MANAGE)
  @Post()
  create(@Body() dto: UpsertArticleDto) {
    return this.articlesService.create(dto);
  }

  @Permissions(PERMISSIONS.PROMOTION_MANAGE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<UpsertArticleDto>) {
    return this.articlesService.update(id, dto);
  }

  @Permissions(PERMISSIONS.PROMOTION_MANAGE)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.articlesService.remove(id);
  }
}