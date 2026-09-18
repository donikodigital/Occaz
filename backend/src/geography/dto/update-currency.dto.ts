// backend/src/geography/dto/update-currency.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateCurrencyDto } from './create-currency.dto';

export class UpdateCurrencyDto extends PartialType(CreateCurrencyDto) {}