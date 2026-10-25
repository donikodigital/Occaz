-- backend/prisma/migrations/20261025190000_refund_percentage_recovery/migration.sql
-- Part du paiement à rendre au client, décidée au moment de l'annulation : sert à reprendre automatiquement un remboursement qui a échoué.
-- Les annulations déjà enregistrées gardent NULL : elles ne sont jamais rejouées automatiquement.
ALTER TABLE "bookings" ADD COLUMN "refundPercentage" DOUBLE PRECISION;
ALTER TABLE "shipments" ADD COLUMN "refundPercentage" DOUBLE PRECISION;

INSERT INTO "platform_settings" ("id", "key", "value", "description", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'jobs.refund_recovery_enabled', to_jsonb(1), 'Reprise automatique des remboursements d''annulations restés en échec (1 = activée, 0 = désactivée).', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
