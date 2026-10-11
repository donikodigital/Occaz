// backend/src/auth/dto/account-auth.dto.ts
// Inscription en étapes, connexion par numéro + mot de passe, mot de passe oublié (clients et conducteurs).
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { AccountType } from '@prisma/client';
import { IsEmail, IsIn, IsOptional, IsPhoneNumber, IsString, Length, Matches, ValidateNested } from 'class-validator';
import { DeviceInfoDto } from './device-info.dto';

const PHONE_MESSAGE = { message: 'Numéro de téléphone invalide (format international requis).' };
const PIN_MESSAGE = { message: 'Le mot de passe doit contenir exactement 6 chiffres.' };

export class SignupPhoneDto {
  @ApiProperty({ example: '+224620000000' })
  @IsPhoneNumber(undefined, PHONE_MESSAGE)
  phone: string;

  @ApiProperty({ enum: [AccountType.CUSTOMER, AccountType.DRIVER] })
  @IsIn([AccountType.CUSTOMER, AccountType.DRIVER])
  accountType: 'CUSTOMER' | 'DRIVER';
}

export class RequestEmailCodeDto {
  @ApiProperty({ example: 'fatoumata@exemple.com' })
  @IsEmail({}, { message: 'Adresse e-mail invalide.' })
  email: string;
}

export class VerifyEmailCodeDto extends RequestEmailCodeDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  code: string;
}

export class SetPasswordDto {
  @ApiProperty({ example: '482913', description: 'Exactement 6 chiffres.' })
  @Matches(/^\d{6}$/, PIN_MESSAGE)
  password: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: '482913', description: 'Mot de passe actuel (6 chiffres).' })
  @Matches(/^\d{6}$/, PIN_MESSAGE)
  currentPassword: string;

  @ApiProperty({ example: '705318', description: 'Nouveau mot de passe (6 chiffres).' })
  @Matches(/^\d{6}$/, PIN_MESSAGE)
  newPassword: string;
}

export class LoginPhoneDto {
  @ApiProperty({ example: '+224620000000' })
  @IsPhoneNumber(undefined, PHONE_MESSAGE)
  phone: string;

  @ApiProperty({ example: '482913', description: 'Exactement 6 chiffres.' })
  @Matches(/^\d{6}$/, PIN_MESSAGE)
  password: string;

  @ApiPropertyOptional({
    enum: [AccountType.CUSTOMER, AccountType.DRIVER],
    description: "Espace choisi à l'écran d'accueil : sert uniquement à expliquer l'erreur quand le compte est de l'autre type.",
  })
  @IsOptional()
  @IsIn([AccountType.CUSTOMER, AccountType.DRIVER])
  expectedAccountType?: 'CUSTOMER' | 'DRIVER';

  @ApiPropertyOptional({ type: DeviceInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DeviceInfoDto)
  device?: DeviceInfoDto;
}

export class ForgotPasswordRequestDto {
  @ApiProperty({ example: '+224620000000' })
  @IsPhoneNumber(undefined, PHONE_MESSAGE)
  phone: string;

  @ApiProperty({ enum: ['SMS', 'EMAIL'], description: "Canal d'envoi du code : SMS au numéro, ou e-mail vérifié du compte." })
  @IsIn(['SMS', 'EMAIL'])
  channel: 'SMS' | 'EMAIL';
}

export class ForgotPasswordVerifyDto {
  @ApiProperty({ example: '+224620000000' })
  @IsPhoneNumber(undefined, PHONE_MESSAGE)
  phone: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  code: string;
}

export class ForgotPasswordResetDto {
  @ApiProperty({ description: 'Jeton reçu après la vérification du code (valable 10 minutes, usage unique).' })
  @IsString()
  resetToken: string;

  @ApiProperty({ example: '482913', description: 'Exactement 6 chiffres.' })
  @Matches(/^\d{6}$/, PIN_MESSAGE)
  newPassword: string;
}
