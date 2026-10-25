// backend/src/company-documents/dto/company-document.dto.ts
// [25/10/2026] v1 — Entrées de l'API des documents de l'entreprise.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import {
  COMPANY_DOCUMENT_CATEGORIES,
  DOCUMENT_CONTENT_TYPE_LIST,
  MAX_DOCUMENT_BYTES,
  type CompanyDocumentCategoryKey,
  type DocumentContentType,
} from '../company-document-rules';

const DATE_MESSAGE = 'La date doit être au format AAAA-MM-JJ.';

export class ListCompanyDocumentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: COMPANY_DOCUMENT_CATEGORIES })
  @IsOptional()
  @IsIn(COMPANY_DOCUMENT_CATEGORIES)
  category?: CompanyDocumentCategoryKey;
}

export class RequestDocumentUploadDto {
  @ApiProperty({ enum: DOCUMENT_CONTENT_TYPE_LIST, description: 'Type du fichier : PDF, Word, Excel, PowerPoint ou image.' })
  @IsIn(DOCUMENT_CONTENT_TYPE_LIST, { message: 'Ce type de fichier n’est pas accepté (PDF, Word, Excel, PowerPoint, JPG, PNG ou WebP).' })
  contentType: DocumentContentType;

  @ApiProperty({ description: 'Taille du fichier en octets (contrôlée une seconde fois après l’envoi).' })
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Le fichier est vide.' })
  @Max(MAX_DOCUMENT_BYTES, { message: 'Le fichier dépasse 25 Mo.' })
  sizeBytes: number;
}

export class CreateCompanyDocumentDto {
  @ApiProperty({ example: 'PV de la réunion du bureau — octobre 2026' })
  @IsString()
  @IsNotEmpty({ message: 'Donne un titre au document.' })
  @MaxLength(150)
  title: string;

  @ApiProperty({ enum: COMPANY_DOCUMENT_CATEGORIES })
  @IsIn(COMPANY_DOCUMENT_CATEGORIES)
  category: CompanyDocumentCategoryKey;

  @ApiPropertyOptional({ description: 'Jour de la réunion, date de signature…', example: '2026-10-12' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: DATE_MESSAGE })
  documentDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ description: 'Réservé : visible du seul SuperAdmin et de la personne qui dépose le document.' })
  @IsOptional()
  @IsBoolean()
  restricted?: boolean;

  @ApiProperty({ description: 'Clé reçue avec le lien d’envoi.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  storageKey: string;

  @ApiProperty({ description: 'Nom d’origine du fichier.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  fileName: string;

  @ApiProperty({ enum: DOCUMENT_CONTENT_TYPE_LIST })
  @IsIn(DOCUMENT_CONTENT_TYPE_LIST)
  contentType: DocumentContentType;
}

export class UpdateCompanyDocumentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Le titre ne peut pas être vide.' })
  @MaxLength(150)
  title?: string;

  @ApiPropertyOptional({ enum: COMPANY_DOCUMENT_CATEGORIES })
  @IsOptional()
  @IsIn(COMPANY_DOCUMENT_CATEGORIES)
  category?: CompanyDocumentCategoryKey;

  @ApiPropertyOptional({ description: 'AAAA-MM-JJ ; chaîne vide pour effacer la date.' })
  @IsOptional()
  @Matches(/^(\d{4}-\d{2}-\d{2})?$/, { message: DATE_MESSAGE })
  documentDate?: string;

  @ApiPropertyOptional({ description: 'Chaîne vide pour effacer la description.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  restricted?: boolean;
}

export class DocumentLinkQueryDto {
  @ApiPropertyOptional({ enum: ['open', 'download'], default: 'open', description: '« open » : ouvre dans le navigateur quand c’est possible ; « download » : enregistre.' })
  @IsOptional()
  @IsIn(['open', 'download'])
  mode?: 'open' | 'download';
}
