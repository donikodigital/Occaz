// backend/src/storage/dto/request-upload-url.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

/** Types de fichiers volontairement restreints — jamais de contentType arbitraire accepté du client. */
const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;

export class RequestUploadUrlDto {
  @ApiProperty({ example: 'national_id', description: 'Même valeur que `type` sur CreateDocumentDto.' })
  @IsString()
  type: string;

  @ApiProperty({ enum: ALLOWED_CONTENT_TYPES })
  @IsIn(ALLOWED_CONTENT_TYPES)
  contentType: (typeof ALLOWED_CONTENT_TYPES)[number];
}

const EXTENSION_BY_CONTENT_TYPE: Record<(typeof ALLOWED_CONTENT_TYPES)[number], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export function extensionForContentType(contentType: RequestUploadUrlDto['contentType']): string {
  return EXTENSION_BY_CONTENT_TYPE[contentType];
}
