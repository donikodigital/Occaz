// backend/src/auth/dto/confirm-phone-change.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber, IsString, Length } from 'class-validator';

export class ConfirmPhoneChangeDto {
  @ApiProperty({ example: '+224620000000', description: 'Le nouveau numéro auquel le code a été envoyé.' })
  @IsPhoneNumber(undefined, { message: 'Numéro de téléphone invalide (format international requis).' })
  newPhone: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  code: string;
}
