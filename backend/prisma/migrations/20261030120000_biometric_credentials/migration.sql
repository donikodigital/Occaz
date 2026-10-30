-- backend/prisma/migrations/20261030120000_biometric_credentials/migration.sql
-- [30/10/2026] Connexion rapide par empreinte digitale : un secret aléatoire par téléphone (hash seul en base), renouvelé à chaque usage.
CREATE TABLE "biometric_credentials" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "previousTokenHash" TEXT,
    "rotatedAt" TIMESTAMP(3),
    "platform" TEXT,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "biometric_credentials_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "biometric_credentials_userId_idx" ON "biometric_credentials"("userId");

ALTER TABLE "biometric_credentials" ADD CONSTRAINT "biometric_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
