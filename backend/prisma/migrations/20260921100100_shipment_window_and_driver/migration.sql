-- AlterTable : colonnes ajoutées nulles, remplies pour les lignes existantes, puis rendues obligatoires
ALTER TABLE "shipments" ADD COLUMN     "driverId" TEXT,
ADD COLUMN     "extensionRequestedAt" TIMESTAMP(3),
ADD COLUMN     "windowEnd" TIMESTAMP(3),
ADD COLUMN     "windowStart" TIMESTAMP(3);

-- Le chauffeur des envois déjà rattachés à un trajet est celui du trajet
UPDATE "shipments" SET "driverId" = "trips"."driverId" FROM "trips" WHERE "shipments"."tripId" = "trips"."id";

-- Plage par défaut des envois existants : de leur création à 7 jours plus tard
UPDATE "shipments" SET "windowStart" = "createdAt", "windowEnd" = "createdAt" + INTERVAL '7 days';

ALTER TABLE "shipments" ALTER COLUMN "windowEnd" SET NOT NULL,
ALTER COLUMN "windowStart" SET NOT NULL;

-- CreateIndex
CREATE INDEX "shipments_driverId_idx" ON "shipments"("driverId");

-- CreateIndex
CREATE INDEX "shipments_status_windowEnd_idx" ON "shipments"("status", "windowEnd");

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "driver_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;