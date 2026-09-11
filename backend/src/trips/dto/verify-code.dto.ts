// backend/src/trips/dto/verify-code.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class VerifyCodeDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  code: string;
}
