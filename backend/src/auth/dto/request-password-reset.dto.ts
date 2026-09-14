// backend/src/auth/dto/request-password-reset.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class RequestPasswordResetDto {
  @ApiProperty()
  @IsEmail()
  email: string;
}
