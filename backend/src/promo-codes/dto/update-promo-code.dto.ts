// backend/src/promo-codes/dto/update-promo-code.dto.ts
import { PartialType } from '@nestjs/swagger';
import { UpsertPromoCodeDto } from './upsert-promo-code.dto';

/** Modification d'un code promo : mêmes règles que la création, tous les champs facultatifs (et validés). */
export class UpdatePromoCodeDto extends PartialType(UpsertPromoCodeDto) {}
