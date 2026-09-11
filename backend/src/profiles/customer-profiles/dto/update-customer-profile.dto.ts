// backend/src/profiles/customer-profiles/dto/update-customer-profile.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateCustomerProfileDto } from './create-customer-profile.dto';

export class UpdateCustomerProfileDto extends PartialType(CreateCustomerProfileDto) {}
