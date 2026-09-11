// backend/src/disputes/dto/add-dispute-message.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class AddDisputeMessageDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  message: string;
}
