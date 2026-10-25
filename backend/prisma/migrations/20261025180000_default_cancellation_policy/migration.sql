-- backend/prisma/migrations/20261025180000_default_cancellation_policy/migration.sql
-- Politique d'annulation par défaut des trajets (pour tous les pays) : remboursement intégral jusqu'à 24 h avant la prise en charge, rien ensuite.
-- Créée seulement s'il n'existe encore aucune politique globale active pour les trajets ; modifiable ensuite dans le back-office.
INSERT INTO "cancellation_policies" ("id", "serviceType", "countryId", "hoursBeforeDeparture", "refundPercentage", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'TRIP', NULL, 24, 100, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "cancellation_policies" WHERE "serviceType" = 'TRIP' AND "countryId" IS NULL AND "isActive" = true
);
