// backend/src/tickets/dto/scan-ticket.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ScanTicketDto {
  @ApiProperty({ description: 'Contenu lu dans le QR code d’un billet ou d’une étiquette (« OCCAZ1:… »).' })
  @IsString()
  @MinLength(10)
  @MaxLength(300)
  code: string;
}
