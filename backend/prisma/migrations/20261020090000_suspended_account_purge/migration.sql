-- backend/prisma/migrations/20261020090000_suspended_account_purge/migration.sql
-- Suppression définitive des comptes suspendus depuis 6 mois : on mémorise le début de la suspension.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "suspendedAt" TIMESTAMP(3);

-- Les comptes déjà suspendus au moment du déploiement reçoivent leurs 6 mois complets à partir d'aujourd'hui :
-- aucun compte n'est supprimé par surprise le jour de la mise en ligne.
UPDATE "users" SET "suspendedAt" = CURRENT_TIMESTAMP WHERE "isSuspended" = true;

-- CreateIndex
CREATE INDEX "users_isSuspended_suspendedAt_idx" ON "users"("isSuspended", "suspendedAt");
