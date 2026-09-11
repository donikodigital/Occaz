// backend/src/vehicles/dto/update-vehicle.dto.ts
import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateVehicleDto } from './create-vehicle.dto';

/** L'immatriculation ne se modifie pas en libre-service (risque de fraude). */
export class UpdateVehicleDto extends PartialType(
  OmitType(CreateVehicleDto, ['plateNumber'] as const),
) {}
