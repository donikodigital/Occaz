-- backend/prisma/migrations/20261019100000_withdrawal_pin_guardrails/migration.sql
-- Retraits sécurisés (19/10/2026).
--  - OtpPurpose.WITHDRAWAL : code à 6 chiffres envoyé par e-mail au SuperAdmin pour confirmer un retrait du portefeuille plateforme
--    (remplace le mot de passe saisi en clair). Côté conducteur, la confirmation est le code PIN de connexion : aucune table à ajouter.
--  - Version minimale de l'application mobile (mise à jour forcée) : app.min_version et liens des boutiques.
--  - Garde-fous des retraits conducteur, modifiables dans l'admin (page « Paramètres »), sans redéploiement.
-- ON CONFLICT DO NOTHING : une valeur déjà saisie n'est jamais écrasée.
ALTER TYPE "OtpPurpose" ADD VALUE IF NOT EXISTS 'WITHDRAWAL';

INSERT INTO "platform_settings" ("id", "key", "value", "description", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'payout.min_amount', to_jsonb(1), 'Montant minimum d''un retrait conducteur (plus petite unité de la devise du portefeuille). Au moins 1.', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'app.min_version', to_jsonb('0.0.0'::text), 'Version minimale de l''application mobile (ex. 1.4.0). En dessous, l''application affiche « Mise à jour requise ». 0.0.0 = aucune exigence.', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'app.update_url_android', to_jsonb(''::text), 'Lien Google Play de l''application (https://…), ouvert par le bouton « Mettre à jour ».', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'app.update_url_ios', to_jsonb(''::text), 'Lien App Store de l''application (https://…), ouvert par le bouton « Mettre à jour ».', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'payout.daily_max_amount', to_jsonb(0), 'Total maximum retirable par un conducteur sur 24 heures glissantes (0 = aucune limite). Plus petite unité de la devise du portefeuille.', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
