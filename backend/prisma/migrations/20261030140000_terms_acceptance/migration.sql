-- backend/prisma/migrations/20261030140000_terms_acceptance/migration.sql
-- [30/10/2026] Case « J'accepte les conditions d'utilisation et la politique de confidentialité » à l'inscription : date et version gardées sur le compte.
ALTER TABLE "users" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN "termsVersion" TEXT;
