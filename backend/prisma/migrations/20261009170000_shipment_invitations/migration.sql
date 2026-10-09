-- Invitations d'un client à un conducteur pour prendre son colis.

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SHIPMENT_INVITATION';

-- CreateEnum
CREATE TYPE "ShipmentInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateTable
CREATE TABLE "shipment_invitations" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "tripId" TEXT,
    "status" "ShipmentInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipment_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shipment_invitations_driverId_status_idx" ON "shipment_invitations"("driverId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "shipment_invitations_shipmentId_driverId_key" ON "shipment_invitations"("shipmentId", "driverId");

-- AddForeignKey
ALTER TABLE "shipment_invitations" ADD CONSTRAINT "shipment_invitations_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_invitations" ADD CONSTRAINT "shipment_invitations_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "driver_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_invitations" ADD CONSTRAINT "shipment_invitations_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;
