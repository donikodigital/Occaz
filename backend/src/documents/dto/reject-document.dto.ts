// backend/src/documents/dto/reject-document.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RejectDocumentDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  reason: string;
}
