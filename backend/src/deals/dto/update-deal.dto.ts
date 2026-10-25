// backend/src/deals/dto/update-deal.dto.ts
import { PartialType } from '@nestjs/swagger';
import { UpsertDealDto } from './upsert-deal.dto';

/** Modification d'un bon plan : mêmes règles que la création, tous les champs facultatifs (et validés). */
export class UpdateDealDto extends PartialType(UpsertDealDto) {}
