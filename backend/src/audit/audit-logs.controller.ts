// backend/src/audit/audit-logs.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { AuditService } from './audit.service';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

@ApiTags('Administration — Journal d\'audit')
@ApiBearerAuth()
@Permissions(PERMISSIONS.AUDIT_READ)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * Un seul DTO pour toute la query (pagination + filtres) : des
   * @Query('entityType') séparés seraient rejetés en 400 par le
   * ValidationPipe global (forbidNonWhitelisted) — voir ListAuditLogsQueryDto.
   */
  @Get()
  findAll(@Query() query: ListAuditLogsQueryDto) {
    return this.auditService.findAll(query, {
      entityType: query.entityType,
      entityId: query.entityId,
      actorId: query.actorId,
    });
  }
}