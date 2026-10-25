// backend/src/articles/articles.controller.ts
// [25/10/2026] v+ — GET /articles/:id ne renvoie un brouillon / une actualité désactivée qu'à la gestion des promotions ; PATCH validé (UpdateArticleDto).
// [23/10/2026] v+ — actualités publiées : le filtre pays passe par ListPublishedArticlesQueryDto (il faisait échouer la requête en 400).
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ListPublishedArticlesQueryDto } from './dto/list-published-articles-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { ArticlesService } from './articles.service';
import { UpsertArticleDto } from './dto/upsert-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

@ApiTags('Actualités')
@ApiBearerAuth()
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Get('published')
  findPublished(@Query() query: ListPublishedArticlesQueryDto) {
    return this.articlesService.findPublished(query, query.countryId);
  }

  @Permissions(PERMISSIONS.PROMOTION_MANAGE)
  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.articlesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const canSeeDrafts = user.permissions.includes(PERMISSIONS.PROMOTION_MANAGE);
    return canSeeDrafts ? this.articlesService.findOne(id) : this.articlesService.findOnePublished(id);
  }

  @Permissions(PERMISSIONS.PROMOTION_MANAGE)
  @Post()
  create(@Body() dto: UpsertArticleDto) {
    return this.articlesService.create(dto);
  }

  @Permissions(PERMISSIONS.PROMOTION_MANAGE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateArticleDto) {
    return this.articlesService.update(id, dto);
  }

  @Permissions(PERMISSIONS.PROMOTION_MANAGE)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.articlesService.remove(id);
  }
}