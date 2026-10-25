-- backend/prisma/migrations/20261025140000_noshow_autoclose_payout_delay/migration.sql
-- Passager absent / clôture automatique des trajets : horodatage de l'arrivée du conducteur (départ) et de l'arrivée à destination.
-- Retraits automatiques : date d'envoi différé pour un numéro jamais utilisé.

-- AlterTable
ALTER TABLE "trips" ADD COLUMN "driverArrivedAt" TIMESTAMP(3),
ADD COLUMN "arrivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "payouts" ADD COLUMN "autoReleaseAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "payouts_status_autoReleaseAt_idx" ON "payouts"("status", "autoReleaseAt");

INSERT INTO "platform_settings" ("id", "key", "value", "description", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'payout.new_destination_delay_minutes', to_jsonb(60), 'Retrait automatique vers un numéro jamais utilisé : délai de sécurité (en minutes) avant l''envoi, pendant lequel le conducteur peut annuler. 0 = envoi immédiat.', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'booking.no_show_wait_minutes', to_jsonb(15), 'Attente minimale (en minutes) avant qu''un conducteur puisse déclarer un client absent au point de rendez-vous.', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'trip.auto_close_hours', to_jsonb(6), 'Heures après l''arrivée à destination au bout desquelles un trajet dont des réservations ne sont pas clôturées est clos automatiquement (dépose validée ou client absent) et le conducteur payé.', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'jobs.trip_autoclose_enabled', to_jsonb(1), 'Clôture automatique des trajets restés à l''arrivée (1 = activée, 0 = désactivée).', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'jobs.payout_auto_release_enabled', to_jsonb(1), 'Envoi automatique des retraits à échéance (1 = activé, 0 = désactivé).', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
