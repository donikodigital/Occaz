// backend/src/disputes/dto/assign-dispute.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DisputePriority } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class AssignDisputeDto {
  @ApiProperty({ description: "Id de l'agent (User) à qui confier le litige" })
  @IsString()
  agentUserId: string;

  @ApiPropertyOptional({ enum: DisputePriority })
  @IsOptional()
  @IsEnum(DisputePriority)
  priority?: DisputePriority;
}
