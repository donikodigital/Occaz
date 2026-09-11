// backend/src/profiles/driver-profiles/dto/update-driver-profile.dto.ts
import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateDriverProfileDto } from './create-driver-profile.dto';

/**
 * countryId/cityId ne sont pas modifiables librement par le chauffeur
 * lui-même une fois le compte créé (impact sur la portée RBAC, les
 * commissions par pays, etc.) — un changement de pays passe par le support.
 */
export class UpdateDriverProfileDto extends PartialType(
  OmitType(CreateDriverProfileDto, ['countryId', 'cityId'] as const),
) {}
