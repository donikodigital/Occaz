// backend/src/documents/documents.controller.ts
import { Controller, Get, Param, Patch, Body, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { CountryScopeService } from '../common/scope/country-scope.service';
import { DocumentsService } from './documents.service';
import { RejectDocumentDto } from './dto/reject-document.dto';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto';

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
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly scope: CountryScopeService,
  ) {}

  @Get()
  async findAll(@Query() query: ListDocumentsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    // Un agent limité à un pays doit cibler un propriétaire (conducteur, véhicule…) de son périmètre.
    await this.scope.assertDocumentListAllowed(user, PERMISSIONS.DOCUMENT_READ, {
      ownerType: query.ownerType,
      ownerId: query.ownerId,
    });
    return this.documentsService.findAll(query, {
      ownerType: query.ownerType,
      ownerId: query.ownerId,
      status: query.status,
    });
  }

  @Get('expiring-soon')
  async findExpiringSoon(@CurrentUser() user: AuthenticatedUser, @Query('days') days?: string) {
    const documents = await this.documentsService.findExpiringSoon(days ? parseInt(days, 10) : 30);
    return this.scope.filterDocuments(user, PERMISSIONS.DOCUMENT_READ, documents);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.scope.assertDocument(user, PERMISSIONS.DOCUMENT_READ, id);
    return this.documentsService.findOne(id);
  }

  @Get(':id/download-url')
  async getDownloadUrl(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.scope.assertDocument(user, PERMISSIONS.DOCUMENT_READ, id);
    return this.documentsService.createDownloadUrl(id);
  }

  @Permissions(PERMISSIONS.DOCUMENT_VERIFY)
  @Patch(':id/verify')
  async verify(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.scope.assertDocument(user, PERMISSIONS.DOCUMENT_VERIFY, id);
    return this.documentsService.verify(id, user.id);
  }

  @Permissions(PERMISSIONS.DOCUMENT_VERIFY)
  @Patch(':id/reject')
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.scope.assertDocument(user, PERMISSIONS.DOCUMENT_VERIFY, id);
    return this.documentsService.reject(id, dto.reason, user.id);
  }
}