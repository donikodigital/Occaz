// backend/src/articles/articles.module.ts
import { Module } from '@nestjs/common';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';

@Module({
  controllers: [ArticlesController],
  providers: [ArticlesService],
})
export class ArticlesModule {}