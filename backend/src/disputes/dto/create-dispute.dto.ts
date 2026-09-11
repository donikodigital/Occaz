// backend/src/disputes/dto/create-dispute.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateDisputeDto {
  @ApiProperty({ enum: ServiceType })
  @IsEnum(ServiceType)
  subjectType: ServiceType;

  @ApiPropertyOptional({ description: 'Requis si subjectType = TRIP' })
  @IsOptional()
  @IsString()
  bookingId?: string;

  @ApiPropertyOptional({ description: 'Requis si subjectType = SHIPMENT' })
  @IsOptional()
  @IsString()
  shipmentId?: string;

  @ApiProperty({ example: 'Colis non reçu' })
  @IsString()
  @MinLength(3)
  reason: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
