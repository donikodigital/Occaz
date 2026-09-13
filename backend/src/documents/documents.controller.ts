// backend/src/documents/documents.controller.ts
import { Controller, Get, Param, Patch, Body, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DocumentOwnerType, DocumentStatus } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { DocumentsService } from './documents.service';
import { RejectDocumentDto } from './dto/reject-document.dto';

/**
 * Vue d'ensemble admin, tous types de propriétaires confondus. L'upload
 * se fait via les routes dédiées des modules propriétaires
 * (ex: POST /driver-profiles/me/documents, POST /vehicles/:id/documents),
 * jamais directement ici — voir le commentaire de DocumentsService.
 */
@ApiTags('Documents (vue admin)')
@ApiBearerAuth()
@Permissions(PERMISSIONS.DOCUMENT_READ)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  findAll(
    @Query() query: PaginationQueryDto,
    @Query('ownerType') ownerType?: DocumentOwnerType,
    @Query('ownerId') ownerId?: string,
    @Query('status') status?: DocumentStatus,
  ) {
    return this.documentsService.findAll(query, { ownerType, ownerId, status });
  }

  @Get('expiring-soon')
  findExpiringSoon(@Query('days') days?: string) {
    return this.documentsService.findExpiringSoon(days ? parseInt(days, 10) : 30);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.documentsService.findOne(id);
  }

  @Get(':id/download-url')
  getDownloadUrl(@Param('id') id: string) {
    return this.documentsService.createDownloadUrl(id);
  }

  @Permissions(PERMISSIONS.DOCUMENT_VERIFY)
  @Patch(':id/verify')
  verify(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.verify(id, user.id);
  }

  @Permissions(PERMISSIONS.DOCUMENT_VERIFY)
  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.reject(id, dto.reason, user.id);
  }
}
