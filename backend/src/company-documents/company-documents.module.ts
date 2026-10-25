// backend/src/company-documents/company-documents.module.ts
// [25/10/2026] v1 — Documents de l'entreprise (PV de réunion, statuts, contrats…) dans le stockage d'objets.
import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { CompanyDocumentsController } from './company-documents.controller';
import { CompanyDocumentsService } from './company-documents.service';

@Module({
  imports: [StorageModule],
  controllers: [CompanyDocumentsController],
  providers: [CompanyDocumentsService],
})
export class CompanyDocumentsModule {}
