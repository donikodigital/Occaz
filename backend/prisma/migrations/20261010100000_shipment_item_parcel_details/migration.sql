-- Saisie colis par colis : chaque colis d'un envoi multiple garde ses dimensions, sa valeur déclarée, sa description et son prix.
ALTER TABLE "shipment_items"
  ADD COLUMN "lengthCm" DOUBLE PRECISION,
  ADD COLUMN "widthCm" DOUBLE PRECISION,
  ADD COLUMN "heightCm" DOUBLE PRECISION,
  ADD COLUMN "declaredValue" BIGINT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "price" BIGINT;
