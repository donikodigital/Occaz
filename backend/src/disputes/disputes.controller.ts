// backend/src/disputes/disputes.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DisputePriority, DisputeStatus } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { DisputesService } from './disputes.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { AddDisputeMessageDto } from './dto/add-dispute-message.dto';
import { AddDisputeEvidenceDto } from './dto/add-dispute-evidence.dto';
import { AssignDisputeDto } from './dto/assign-dispute.dto';
import { UpdateDisputeStatusDto } from './dto/update-dispute-status.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';

@ApiTags('Litiges')
@ApiBearerAuth()
@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Get('mine')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.disputesService.findAllForUser(user.id);
  }

  @Post()
  create(@Body() dto: CreateDisputeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.disputesService.create(user.id, dto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.disputesService.assertCanAccess(id, user.id, user.permissions.includes(PERMISSIONS.DISPUTE_READ));
    return this.disputesService.findOne(id);
  }

  @Post(':id/messages')
  async addMessage(
    @Param('id') id: string,
    @Body() dto: AddDisputeMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.disputesService.assertCanAccess(id, user.id, user.permissions.includes(PERMISSIONS.DISPUTE_READ));
    return this.disputesService.addMessage(id, user.id, dto.message);
  }

  @Post(':id/evidence')
  async addEvidence(
    @Param('id') id: string,
    @Body() dto: AddDisputeEvidenceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.disputesService.assertCanAccess(id, user.id, user.permissions.includes(PERMISSIONS.DISPUTE_READ));
    return this.disputesService.addEvidence(id, dto);
  }

  @Permissions(PERMISSIONS.DISPUTE_ASSIGN)
  @Patch(':id/assign')
  assign(
    @Param('id') id: string,
    @Body() dto: AssignDisputeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.disputesService.assign(id, dto.agentUserId, dto.priority, user.id);
  }

  @Permissions(PERMISSIONS.DISPUTE_RESOLVE)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateDisputeStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.disputesService.updateStatus(id, dto.status, user.id);
  }

  @Permissions(PERMISSIONS.DISPUTE_RESOLVE)
  @Post(':id/resolve')
  resolve(
    @Param('id') id: string,
    @Body() dto: ResolveDisputeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.disputesService.resolve(id, dto, user.id);
  }

  @Permissions(PERMISSIONS.DISPUTE_RESOLVE)
  @Post(':id/close')
  close(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.disputesService.close(id, user.id);
  }

  @Permissions(PERMISSIONS.DISPUTE_READ)
  @Get()
  findAll(
    @Query() query: PaginationQueryDto,
    @Query('status') status?: DisputeStatus,
    @Query('priority') priority?: DisputePriority,
    @Query('assignedAgentId') assignedAgentId?: string,
  ) {
    return this.disputesService.findAll(query, { status, priority, assignedAgentId });
  }
}
