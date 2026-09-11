// backend/src/auth/dto/enable-two-factor.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class EnableTwoFactorDto {
  @ApiProperty({ description: 'Code TOTP généré par l\'application d\'authentification' })
  @IsString()
  @Length(6, 6)
  code: string;
}
