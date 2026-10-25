// backend/src/articles/dto/update-article.dto.ts
import { PartialType } from '@nestjs/swagger';
import { UpsertArticleDto } from './upsert-article.dto';

/** Modification d'une actualité : mêmes règles que la création, tous les champs facultatifs (et validés). */
export class UpdateArticleDto extends PartialType(UpsertArticleDto) {}
