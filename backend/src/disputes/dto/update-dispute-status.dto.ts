// backend/src/disputes/dto/update-dispute-status.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { DisputeStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateDisputeStatusDto {
  @ApiProperty({
    enum: [
      DisputeStatus.UNDER_REVIEW,
      DisputeStatus.WAITING_FOR_CUSTOMER,
      DisputeStatus.WAITING_FOR_DRIVER,
      DisputeStatus.INVESTIGATION,
    ],
    description: 'RESOLVED et CLOSED se posent via POST /disputes/:id/resolve et /close, pas ici.',
  })
  @IsEnum(DisputeStatus)
  status: DisputeStatus;
}
