// backend/src/staff-accounts/dto/staff-invitation.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class InspectInvitationDto {
  @ApiProperty({ description: 'Jeton contenu dans le lien reçu par e-mail.' })
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token: string;
}

export class AcceptInvitationDto extends InspectInvitationDto {
  @ApiProperty({ description: '10 caractères minimum, avec au moins une lettre et un chiffre.' })
  @IsString()
  @MinLength(10, { message: 'Le mot de passe doit contenir au moins 10 caractères.' })
  // bcrypt ne lit que les 72 premiers octets : au-delà, deux mots de passe différents donneraient le même hash.
  @MaxLength(72, { message: 'Le mot de passe est trop long (72 caractères au plus).' })
  @Matches(/[A-Za-z]/, { message: 'Le mot de passe doit contenir au moins une lettre.' })
  @Matches(/\d/, { message: 'Le mot de passe doit contenir au moins un chiffre.' })
  newPassword: string;
}
