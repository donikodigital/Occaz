// backend/src/articles/dto/upsert-article.dto.ts
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional, IsString, IsUrl } from 'class-validator';

export class UpsertArticleDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  excerpt?: string;

  @ApiProperty()
  @IsString()
  content: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  coverImageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  countryId?: string;

  @ApiPropertyOptional({ description: 'Omis = brouillon, non publié' })
  @IsOptional()
  @IsDateString()
  publishedAt?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}