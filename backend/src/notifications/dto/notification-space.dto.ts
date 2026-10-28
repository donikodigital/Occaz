// backend/src/notifications/dto/notification-space.dto.ts
// [28/10/2026] v1 — Espace d'où l'application lit sa boîte de notifications (une même personne peut être client ET conducteur).
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export const NOTIFICATION_SPACES = ['CUSTOMER', 'DRIVER'] as const;
export type NotificationSpace = (typeof NOTIFICATION_SPACES)[number];

/** Paramètre `?space=` des routes de la boîte : sans lui, toute la boîte est concernée (back-office, anciennes versions de l'app). */
export class NotificationSpaceQueryDto {
  @ApiPropertyOptional({ enum: NOTIFICATION_SPACES, description: "Espace actif de l'application : seules les notifications de cet espace sont concernées." })
  @IsOptional()
  @IsIn(NOTIFICATION_SPACES)
  space?: NotificationSpace;
}

export class ListNotificationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: NOTIFICATION_SPACES, description: "Espace actif de l'application : seules les notifications de cet espace sont listées." })
  @IsOptional()
  @IsIn(NOTIFICATION_SPACES)
  space?: NotificationSpace;
}
