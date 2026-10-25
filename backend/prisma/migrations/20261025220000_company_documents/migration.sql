-- backend/prisma/migrations/20261025220000_company_documents/migration.sql
-- [25/10/2026] Documents de l'entreprise (procès-verbaux, statuts, contrats…) : la fiche en base, le fichier dans le stockage d'objets.

-- CreateEnum
CREATE TYPE "CompanyDocumentCategory" AS ENUM ('MEETING_MINUTES', 'LEGAL', 'CONTRACT', 'FINANCE', 'HR', 'INSURANCE', 'OTHER');

-- CreateTable
CREATE TABLE "company_documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "CompanyDocumentCategory" NOT NULL,
    "description" TEXT,
    "documentDate" DATE,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "restricted" BOOLEAN NOT NULL DEFAULT false,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_documents_storageKey_key" ON "company_documents"("storageKey");
CREATE INDEX "company_documents_category_documentDate_idx" ON "company_documents"("category", "documentDate");
CREATE INDEX "company_documents_createdAt_idx" ON "company_documents"("createdAt");

-- AddForeignKey
ALTER TABLE "company_documents" ADD CONSTRAINT "company_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
