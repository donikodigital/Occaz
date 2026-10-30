// backend/src/users/dto/update-user.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional } from 'class-validator';
import { APP_LANGUAGES, AppLanguage } from '../../i18n/language';

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  /** Langue choisie dans l'application : le serveur écrit notifications, SMS, e-mails et erreurs dans cette langue. */
  @ApiPropertyOptional({ enum: APP_LANGUAGES })
  @IsOptional()
  @IsIn(APP_LANGUAGES as unknown as string[], { message: 'Langue non prise en charge.' })
  language?: AppLanguage;
}
