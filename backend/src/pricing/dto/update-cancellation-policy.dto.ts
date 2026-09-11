// backend/src/pricing/dto/update-cancellation-policy.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateCancellationPolicyDto } from './create-cancellation-policy.dto';

export class UpdateCancellationPolicyDto extends PartialType(CreateCancellationPolicyDto) {}
