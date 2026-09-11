// backend/src/trips/dto/update-trip.dto.ts
import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateTripDto } from './create-trip.dto';

/**
 * Autorisé uniquement tant que le trajet est DRAFT (voir TripsService) —
 * les identifiants de villes/localisations ne se modifient pas après
 * publication pour ne pas invalider une recherche déjà affichée.
 */
export class UpdateTripDto extends PartialType(
  OmitType(CreateTripDto, ['originCityId', 'destinationCityId', 'stops'] as const),
) {}
