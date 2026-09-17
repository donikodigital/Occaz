-- AlterTable
ALTER TABLE "cities" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "customer_profiles" ADD COLUMN     "address" TEXT;
