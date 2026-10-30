-- backend/prisma/migrations/20261030100000_session_refresh_grace/migration.sql
-- [30/10/2026] Renouvellement de session : un téléphone qui perd la réponse d'un renouvellement (tunnel, coupure) ne doit plus être
-- déconnecté. L'ancien jeton reste accepté une fois pendant une courte période de grâce (60 s, gérée par le code).
ALTER TABLE "sessions" ADD COLUMN "previousRefreshTokenHash" TEXT;
ALTER TABLE "sessions" ADD COLUMN "refreshRotatedAt" TIMESTAMP(3);
