-- Portefeuille de la plateforme : retrait des commissions (XOF, GNF) vers des numéros Orange Money enregistrés.
-- Le solde n'est PAS stocké : il se calcule à partir des commissions déjà inscrites dans wallet_transactions (type COMMISSION).

-- CreateEnum
CREATE TYPE "PlatformBeneficiaryKind" AS ENUM ('OWNER', 'SUPPORT', 'STAFF', 'OTHER');

-- CreateEnum
CREATE TYPE "PlatformWithdrawalStatus" AS ENUM ('PROCESSING', 'PAID', 'FAILED');

-- CreateTable
CREATE TABLE "platform_beneficiaries" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "holderName" TEXT NOT NULL,
    "kind" "PlatformBeneficiaryKind" NOT NULL DEFAULT 'OWNER',
    "method" TEXT NOT NULL DEFAULT 'orange_money',
    "phone" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_beneficiaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_withdrawals" (
    "id" TEXT NOT NULL,
    "beneficiaryId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "currencyId" TEXT NOT NULL,
    "status" "PlatformWithdrawalStatus" NOT NULL DEFAULT 'PROCESSING',
    "method" TEXT NOT NULL,
    "destinationRef" TEXT NOT NULL,
    "note" TEXT,
    "externalReference" TEXT,
    "failureReason" TEXT,
    "requestedById" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "platform_withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_withdrawals_currencyId_status_idx" ON "platform_withdrawals"("currencyId", "status");

-- CreateIndex
CREATE INDEX "platform_withdrawals_requestedAt_idx" ON "platform_withdrawals"("requestedAt");

-- AddForeignKey
ALTER TABLE "platform_withdrawals" ADD CONSTRAINT "platform_withdrawals_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "platform_beneficiaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_withdrawals" ADD CONSTRAINT "platform_withdrawals_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
