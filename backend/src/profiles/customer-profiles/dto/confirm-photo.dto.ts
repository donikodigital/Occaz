// backend/src/profiles/customer-profiles/dto/confirm-photo.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ConfirmPhotoDto {
  @ApiProperty({ description: "Même storageKey que celui renvoyé par l'étape upload-url." })
  @IsString()
  storageKey: string;
}