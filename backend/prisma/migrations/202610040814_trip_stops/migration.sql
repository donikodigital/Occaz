-- AlterTable
ALTER TABLE "trip_stops" ADD COLUMN     "arrivedAt" TIMESTAMP(3),
ADD COLUMN     "cityId" TEXT,
ADD COLUMN     "distanceFromOriginKm" DOUBLE PRECISION,
ADD COLUMN     "fareFromOrigin" BIGINT,
ADD COLUMN     "isBookable" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "alightingStopId" TEXT,
ADD COLUMN     "boardingStopId" TEXT;

-- CreateIndex
CREATE INDEX "trip_stops_cityId_idx" ON "trip_stops"("cityId");

-- CreateIndex
CREATE INDEX "bookings_boardingStopId_idx" ON "bookings"("boardingStopId");

-- CreateIndex
CREATE INDEX "bookings_alightingStopId_idx" ON "bookings"("alightingStopId");

-- AddForeignKey
ALTER TABLE "trip_stops" ADD CONSTRAINT "trip_stops_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_boardingStopId_fkey" FOREIGN KEY ("boardingStopId") REFERENCES "trip_stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_alightingStopId_fkey" FOREIGN KEY ("alightingStopId") REFERENCES "trip_stops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reprise des étapes existantes : la ville vient de leur adresse. Elles n'ont pas de prix (fareFromOrigin NULL), donc
-- elles restent affichées mais ne sont pas réservables tant que le chauffeur ne les a pas retarifées.
UPDATE "trip_stops" SET "cityId" = "locations"."cityId" FROM "locations" WHERE "locations"."id" = "trip_stops"."locationId";