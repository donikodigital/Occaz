-- backend/prisma/migrations/20261030130000_trusted_devices/migration.sql
-- [30/10/2026] Téléphones de confiance : un code (e-mail ou SMS) est exigé pour se connecter depuis un téléphone qui n'en est pas un.
ALTER TYPE "OtpPurpose" ADD VALUE IF NOT EXISTS 'DEVICE_VERIFICATION';

CREATE TABLE "trusted_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "platform" TEXT,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "trusted_devices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "trusted_devices_userId_idx" ON "trusted_devices"("userId");

ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
