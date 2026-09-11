// backend/src/pricing/cancellation-policies.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ServiceType } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { CancellationPoliciesService } from './cancellation-policies.service';
import { CreateCancellationPolicyDto } from './dto/create-cancellation-policy.dto';
import { UpdateCancellationPolicyDto } from './dto/update-cancellation-policy.dto';

@ApiTags("Tarification — Politiques d'annulation")
@ApiBearerAuth()
@Permissions(PERMISSIONS.CANCELLATION_POLICY_MANAGE)
@Controller('cancellation-policies')
export class CancellationPoliciesController {
  constructor(private readonly cancellationPoliciesService: CancellationPoliciesService) {}

  @Get()
  findAll(@Query('serviceType') serviceType?: ServiceType) {
    return this.cancellationPoliciesService.findAll(serviceType);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cancellationPoliciesService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCancellationPolicyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.cancellationPoliciesService.create(dto, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCancellationPolicyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cancellationPoliciesService.update(id, dto, user.id);
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.cancellationPoliciesService.deactivate(id, user.id);
  }
}
