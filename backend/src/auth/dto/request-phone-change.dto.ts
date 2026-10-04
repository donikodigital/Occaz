// backend/src/auth/dto/request-phone-change.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber } from 'class-validator';

export class RequestPhoneChangeDto {
  @ApiProperty({ example: '+224620000000', description: 'Nouveau numéro, au format international. Le code est envoyé par SMS à ce numéro.' })
  @IsPhoneNumber(undefined, { message: 'Numéro de téléphone invalide (format international requis).' })
  newPhone: string;
}
