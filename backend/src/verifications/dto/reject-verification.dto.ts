// backend/src/verifications/dto/reject-verification.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RejectVerificationDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  reason: string;
}
