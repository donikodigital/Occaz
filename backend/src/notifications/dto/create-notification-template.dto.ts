// backend/src/notifications/dto/create-notification-template.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationChannel, NotificationType } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateNotificationTemplateDto {
  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiPropertyOptional({ default: 'fr' })
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional({ description: "Utilisé pour EMAIL uniquement" })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty({
    example: 'Votre chauffeur {{driverName}} arrive dans {{eta}} minutes.',
    description: 'Placeholders {{cle}} remplacés depuis le payload au moment de l\'envoi.',
  })
  @IsString()
  body: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
