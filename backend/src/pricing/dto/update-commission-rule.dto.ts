// backend/src/pricing/dto/update-commission-rule.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateCommissionRuleDto } from './create-commission-rule.dto';

export class UpdateCommissionRuleDto extends PartialType(CreateCommissionRuleDto) {}
