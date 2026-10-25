-- backend/prisma/migrations/20261025210000_accounting_expense_categories/migration.sql
-- [25/10/2026] Comptabilité : motif de chaque retrait de la plateforme (salaire, prime, fonctionnement, voyage, fournitures, équipements,
-- autre) avec sa pièce comptable PDF, et données de paie du personnel pour les bulletins de salaire.

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('SALARY', 'BONUS', 'OPERATING', 'TRAVEL', 'SUPPLIES', 'OFFICE_EQUIPMENT', 'OTHER');

-- AlterTable : les retraits déjà faits restent valides, rangés sous « Autres »
ALTER TABLE "platform_withdrawals"
    ADD COLUMN "category" "ExpenseCategory" NOT NULL DEFAULT 'OTHER',
    ADD COLUMN "categoryLabel" TEXT,
    ADD COLUMN "staffUserId" TEXT,
    ADD COLUMN "periodMonth" TEXT,
    ADD COLUMN "details" JSONB,
    ADD COLUMN "documentNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "platform_withdrawals_documentNumber_key" ON "platform_withdrawals"("documentNumber");
CREATE INDEX "platform_withdrawals_category_requestedAt_idx" ON "platform_withdrawals"("category", "requestedAt");

-- CreateTable
CREATE TABLE "staff_pay_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT,
    "employeeNumber" TEXT,
    "jobTitle" TEXT,
    "hireDate" TIMESTAMP(3),
    "socialSecurityNumber" TEXT,
    "baseSalary" BIGINT NOT NULL DEFAULT 0,
    "currencyId" TEXT NOT NULL,
    "allowances" JSONB,
    "deductions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_pay_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_pay_profiles_userId_key" ON "staff_pay_profiles"("userId");

-- AddForeignKey
ALTER TABLE "staff_pay_profiles" ADD CONSTRAINT "staff_pay_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_pay_profiles" ADD CONSTRAINT "staff_pay_profiles_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Numéro de pièce : une suite unique pour toutes les pièces (jamais deux fois le même numéro, même si deux retraits partent ensemble).
-- Les numéros sautés (retrait refusé avant l'écriture) sont normaux : l'important est l'unicité.
CREATE SEQUENCE "platform_document_number_seq" START 1;
