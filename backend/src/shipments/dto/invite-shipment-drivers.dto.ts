// backend/src/shipments/dto/invite-shipment-drivers.dto.ts
// [09/10/2026] v1 — trajets (donc conducteurs) auxquels le client envoie son invitation.
import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsString } from 'class-validator';

export const MAX_INVITATIONS_PER_SHIPMENT = 10;

export class InviteShipmentDriversDto {
  @ApiProperty({
    type: [String],
    description: `Trajets trouvés par la recherche (un par conducteur), ${MAX_INVITATIONS_PER_SHIPMENT} invitations au plus par envoi.`,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_INVITATIONS_PER_SHIPMENT)
  @ArrayUnique()
  @IsString({ each: true })
  tripIds: string[];
}
