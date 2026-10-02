// backend/src/disputes/disputes.controller.ts
// [02/10/2026] v+ — résolution : un remboursement exige aussi `refund.create` et une suspension `user.suspend`
// (le rôle « Superviseur clientèle » les a déjà tous les deux ; le SuperAdmin passe toujours).
// [02/10/2026] v+ — Portée par pays : liste, fiche et actions limitées aux litiges du périmètre de l'agent.
import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccountType, DisputePriority, DisputeResolutionType, DisputeStatus } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { CountryScopeService } from '../common/scope/country-scope.service';
import { DisputesService } from './disputes.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { AddDisputeMessageDto } from './dto/add-dispute-message.dto';
import { AddDisputeEvidenceDto } from './dto/add-dispute-evidence.dto';
import { AssignDisputeDto } from './dto/assign-dispute.dto';
import { UpdateDisputeStatusDto } from './dto/update-dispute-status.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';

/** Types de résolution qui déclenchent un remboursement. */
const REFUND_TYPES: DisputeResolutionType[] = [
  DisputeResolutionType.FULL_REFUND,
  DisputeResolutionType.PARTIAL_REFUND,
  DisputeResolutionType.SHARED_RESPONSIBILITY,
];

@ApiTags('Litiges')
@ApiBearerAuth()
@Controller('disputes')
export class DisputesController {
  constructor(
    private readonly disputesService: DisputesService,
    private readonly scope: CountryScopeService,
  ) {}

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
    await this.disputesService.assertCanAccess(id, user.id, await this.scope.hasDisputeAccess(user, id));
    return this.disputesService.findOne(id);
  }

  @Post(':id/messages')
  async addMessage(
    @Param('id') id: string,
    @Body() dto: AddDisputeMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.disputesService.assertCanAccess(id, user.id, await this.scope.hasDisputeAccess(user, id));
    return this.disputesService.addMessage(id, user.id, dto.message);
  }

  @Post(':id/evidence')
  async addEvidence(
    @Param('id') id: string,
    @Body() dto: AddDisputeEvidenceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.disputesService.assertCanAccess(id, user.id, await this.scope.hasDisputeAccess(user, id));
    return this.disputesService.addEvidence(id, dto);
  }

  @Permissions(PERMISSIONS.DISPUTE_ASSIGN)
  @Patch(':id/assign')
  async assign(
    @Param('id') id: string,
    @Body() dto: AssignDisputeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.scope.assertDispute(user, PERMISSIONS.DISPUTE_ASSIGN, id);
    return this.disputesService.assign(id, dto.agentUserId, dto.priority, user.id);
  }

  @Permissions(PERMISSIONS.DISPUTE_RESOLVE)
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateDisputeStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.scope.assertDispute(user, PERMISSIONS.DISPUTE_RESOLVE, id);
    return this.disputesService.updateStatus(id, dto.status, user.id);
  }

  @Permissions(PERMISSIONS.DISPUTE_RESOLVE)
  @Post(':id/resolve')
  async resolve(
    @Param('id') id: string,
    @Body() dto: ResolveDisputeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    this.assertResolutionAllowed(dto.type, user);
    await this.scope.assertDispute(user, PERMISSIONS.DISPUTE_RESOLVE, id);
    if (REFUND_TYPES.includes(dto.type)) {
      // Le remboursement doit lui aussi relever du périmètre de l'agent (sa portée « refund.create » peut être plus étroite).
      await this.scope.assertDispute(user, PERMISSIONS.REFUND_CREATE, id);
    }
    if (dto.type === DisputeResolutionType.SUSPENSION && dto.targetUserId) {
      await this.scope.assertUser(user, PERMISSIONS.USER_SUSPEND, dto.targetUserId);
    }
    return this.disputesService.resolve(id, dto, user.id);
  }

  /** Les types de résolution qui touchent à l'argent ou aux comptes demandent la permission dédiée en plus de `dispute.resolve`. */
  private assertResolutionAllowed(type: DisputeResolutionType, user: AuthenticatedUser): void {
    if (user.accountType === AccountType.SUPERADMIN) return;

    if (REFUND_TYPES.includes(type) && !user.permissions.includes(PERMISSIONS.REFUND_CREATE)) {
      throw new ForbiddenException(`Permission manquante : ${PERMISSIONS.REFUND_CREATE}.`);
    }
    if (type === DisputeResolutionType.SUSPENSION && !user.permissions.includes(PERMISSIONS.USER_SUSPEND)) {
      throw new ForbiddenException(`Permission manquante : ${PERMISSIONS.USER_SUSPEND}.`);
    }
  }

  @Permissions(PERMISSIONS.DISPUTE_RESOLVE)
  @Post(':id/close')
  async close(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.scope.assertDispute(user, PERMISSIONS.DISPUTE_RESOLVE, id);
    return this.disputesService.close(id, user.id);
  }

  @Permissions(PERMISSIONS.DISPUTE_READ)
  @Get()
  findAll(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: DisputeStatus,
    @Query('priority') priority?: DisputePriority,
    @Query('assignedAgentId') assignedAgentId?: string,
  ) {
    return this.disputesService.findAll(
      query,
      { status, priority, assignedAgentId },
      this.scope.disputeWhere(user, PERMISSIONS.DISPUTE_READ),
    );
  }
}