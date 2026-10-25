// backend/src/company-documents/company-documents.controller.ts
// [25/10/2026] v1 — Documents de l'entreprise (PV de réunion, statuts, contrats…). Lecture : COMPANY_DOCUMENT_READ ; dépôt, modification,
// suppression : COMPANY_DOCUMENT_MANAGE (et, pour modifier ou supprimer, être le SuperAdmin ou la personne qui a déposé le document).
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { CompanyDocumentsService } from './company-documents.service';
import {
  CreateCompanyDocumentDto,
  DocumentLinkQueryDto,
  ListCompanyDocumentsQueryDto,
  RequestDocumentUploadDto,
  UpdateCompanyDocumentDto,
} from './dto/company-document.dto';

@ApiTags('Documents de l’entreprise')
@ApiBearerAuth()
@Controller('company-documents')
export class CompanyDocumentsController {
  constructor(private readonly service: CompanyDocumentsService) {}

  @Permissions(PERMISSIONS.COMPANY_DOCUMENT_READ)
  @Get()
  list(@Query() query: ListCompanyDocumentsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.list(query, user);
  }

  @Permissions(PERMISSIONS.COMPANY_DOCUMENT_READ)
  @Get('stats')
  stats(@CurrentUser() user: AuthenticatedUser) {
    return this.service.stats(user);
  }

  @Permissions(PERMISSIONS.COMPANY_DOCUMENT_MANAGE)
  @Post('upload-url')
  requestUpload(@Body() dto: RequestDocumentUploadDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.requestUpload(dto, user);
  }

  @Permissions(PERMISSIONS.COMPANY_DOCUMENT_MANAGE)
  @Post()
  create(@Body() dto: CreateCompanyDocumentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user);
  }

  @Permissions(PERMISSIONS.COMPANY_DOCUMENT_READ)
  @Get(':id/link')
  link(@Param('id') id: string, @Query() query: DocumentLinkQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.link(id, query, user);
  }

  @Permissions(PERMISSIONS.COMPANY_DOCUMENT_MANAGE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCompanyDocumentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.update(id, dto, user);
  }

  @Permissions(PERMISSIONS.COMPANY_DOCUMENT_MANAGE)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.remove(id, user);
  }
}
