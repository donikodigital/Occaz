// backend/src/articles/articles.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/dto/pagination-response.dto';
import { UpsertArticleDto } from './dto/upsert-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

/** Actualités publiées par l'admin (section « Informations »). */
@Injectable()
export class ArticlesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: PaginationQueryDto): Promise<PaginatedResult<unknown>> {
    return Promise.all([
      this.prisma.article.findMany({ skip: query.skip, take: query.take, orderBy: { createdAt: 'desc' } }),
      this.prisma.article.count(),
    ]).then(([data, total]) => new PaginatedResult(data, total, query.page, query.limit));
  }

  /** Visibles côté client : actives, déjà publiées. */
  findPublished(query: PaginationQueryDto, countryId?: string): Promise<PaginatedResult<unknown>> {
    const where = {
      isActive: true,
      publishedAt: { lte: new Date(), not: null },
      ...(countryId ? { OR: [{ countryId: null }, { countryId }] } : {}),
    };
    return Promise.all([
      this.prisma.article.findMany({ where, skip: query.skip, take: query.take, orderBy: { publishedAt: 'desc' } }),
      this.prisma.article.count({ where }),
    ]).then(([data, total]) => new PaginatedResult(data, total, query.page, query.limit));
  }

  /** Une actualité vue par un client : seulement si elle est active et déjà publiée (sinon 404, comme si elle n'existait pas). */
  async findOnePublished(id: string) {
    const article = await this.prisma.article.findFirst({ where: { id, isActive: true, publishedAt: { lte: new Date(), not: null } } });
    if (!article) throw new NotFoundException('Article introuvable.');
    return article;
  }

  async findOne(id: string) {
    const article = await this.prisma.article.findUnique({ where: { id } });
    if (!article) throw new NotFoundException('Article introuvable.');
    return article;
  }

  create(dto: UpsertArticleDto) {
    return this.prisma.article.create({
      data: {
        title: dto.title,
        excerpt: dto.excerpt,
        content: dto.content,
        coverImageUrl: dto.coverImageUrl,
        countryId: dto.countryId,
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : undefined,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateArticleDto) {
    await this.findOne(id);
    return this.prisma.article.update({
      where: { id },
      data: {
        title: dto.title,
        excerpt: dto.excerpt,
        content: dto.content,
        coverImageUrl: dto.coverImageUrl,
        countryId: dto.countryId,
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : undefined,
        isActive: dto.isActive,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.article.delete({ where: { id } });
  }
}