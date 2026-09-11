// backend/src/audit/audit-logs.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuditService } from './audit.service';

@ApiTags('Administration — Journal d\'audit')
@ApiBearerAuth()
@Permissions(PERMISSIONS.AUDIT_READ)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  findAll(
    @Query() query: PaginationQueryDto,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('actorId') actorId?: string,
  ) {
    return this.auditService.findAll(query, { entityType, entityId, actorId });
  }
}
