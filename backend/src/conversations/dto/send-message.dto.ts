// backend/src/conversations/dto/send-message.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SendMessageDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  content: string;
}
