// backend/src/auth/dto/request-otp.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';
import { IsIn, IsOptional, IsPhoneNumber } from 'class-validator';

export class RequestOtpDto {
  @ApiProperty({ example: '+224620000000' })
  @IsPhoneNumber(undefined, { message: 'Numéro de téléphone invalide (format international requis).' })
  phone: string;

  @ApiPropertyOptional({
    enum: [AccountType.CUSTOMER, AccountType.DRIVER],
    description:
      "Type de compte à créer si ce numéro n'est pas encore inscrit. Ignoré si le compte existe déjà.",
  })
  @IsOptional()
  @IsIn([AccountType.CUSTOMER, AccountType.DRIVER])
  signupAccountType?: AccountType;
}
