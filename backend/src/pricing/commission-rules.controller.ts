// backend/src/pricing/commission-rules.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ServiceType } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { CommissionRulesService } from './commission-rules.service';
import { CreateCommissionRuleDto } from './dto/create-commission-rule.dto';
import { UpdateCommissionRuleDto } from './dto/update-commission-rule.dto';

@ApiTags('Tarification — Commissions')
@ApiBearerAuth()
@Permissions(PERMISSIONS.COMMISSION_MANAGE)
@Controller('commission-rules')
export class CommissionRulesController {
  constructor(private readonly commissionRulesService: CommissionRulesService) {}

  @Get()
  findAll(@Query('serviceType') serviceType?: ServiceType) {
    return this.commissionRulesService.findAll(serviceType);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.commissionRulesService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCommissionRuleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.commissionRulesService.create(dto, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCommissionRuleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.commissionRulesService.update(id, dto, user.id);
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.commissionRulesService.deactivate(id, user.id);
  }
}
