// backend/src/shipments/dto/request-parcel-photo-upload.dto.ts
// [19/10/2026] v1 — Demande d'URL d'envoi pour une photo de colis : images seulement (jamais de PDF ni d'autre type de fichier).
import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export const PARCEL_PHOTO_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type ParcelPhotoContentType = (typeof PARCEL_PHOTO_CONTENT_TYPES)[number];

export class RequestParcelPhotoUploadDto {
  @ApiProperty({ enum: PARCEL_PHOTO_CONTENT_TYPES })
  @IsIn(PARCEL_PHOTO_CONTENT_TYPES)
  contentType: ParcelPhotoContentType;
}
