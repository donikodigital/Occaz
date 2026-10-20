// backend/src/staff-accounts/dto/create-staff-account.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsEmail, IsOptional, IsPhoneNumber, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateStaffAccountDto {
  @ApiProperty({ example: 'Mariama' })
  @IsString()
  @MinLength(2, { message: 'Le prénom est obligatoire.' })
  @MaxLength(80)
  firstName: string;

  @ApiProperty({ example: 'Diallo' })
  @IsString()
  @MinLength(2, { message: 'Le nom est obligatoire.' })
  @MaxLength(80)
  lastName: string;

  @ApiProperty({ example: 'mariama.diallo@occaz.sarl' })
  @IsEmail({}, { message: 'Adresse e-mail invalide.' })
  @MaxLength(160)
  email: string;

  @ApiProperty({ example: '+224620000000' })
  @IsPhoneNumber(undefined, { message: 'Numéro de téléphone invalide (format international requis, ex. +224620000000).' })
  phone: string;

  @ApiPropertyOptional({ example: 'Kaloum, Conakry' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @ApiProperty({ description: 'Rôle à donner au compte (jamais « superadmin »).' })
  @IsUUID()
  roleId: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Pays dans lesquels le rôle s\'exerce. Vide ou absent : tous les pays.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(60)
  @IsUUID('all', { each: true })
  countryIds?: string[];
}
