-- AlterTable
ALTER TABLE "trips" ADD COLUMN     "currentLatitude" DOUBLE PRECISION,
ADD COLUMN     "currentLongitude" DOUBLE PRECISION,
ADD COLUMN     "currentPositionUpdatedAt" TIMESTAMP(3);
