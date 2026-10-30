-- backend/prisma/migrations/20261030110000_trip_arrival_backfill/migration.sql
-- [30/10/2026] Le délai d'attente d'un client absent se compte depuis l'instant d'arrivée du conducteur (trips."driverArrivedAt").
-- Les trajets déjà « arrivés » ou en route avant l'ajout de cette colonne n'ont pas de date : on retient leur dernière modification
-- (au plus tard à l'instant de l'arrivée), pour que le code n'ait plus besoin de ce repli.
UPDATE "trips"
SET "driverArrivedAt" = "updatedAt"
WHERE "driverArrivedAt" IS NULL
  AND "status" IN ('DRIVER_ARRIVED', 'PASSENGER_PICKED_UP', 'IN_PROGRESS');
