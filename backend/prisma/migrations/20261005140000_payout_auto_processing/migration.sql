-- AlterTable
ALTER TABLE "payouts" ADD COLUMN     "autoProcessed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "externalReference" TEXT,
ADD COLUMN     "failureReason" TEXT;

-- Réglages du retrait automatique, visibles et modifiables dans l'admin (page « Paramètres »).
--  - payout.auto_enabled : true = un retrait est envoyé tout de suite au prestataire de paiement, sans validation de l'équipe ;
--    false = chaque retrait attend la validation de l'équipe (support / finance), comme avant.
--  - payout.auto_max_amount : au-dessus de ce montant (plus petite unité de la devise du portefeuille), le retrait attend quand
--    même une validation ; 0 = aucune limite.
-- ON CONFLICT DO NOTHING : une valeur déjà saisie n'est jamais écrasée.
INSERT INTO "platform_settings" ("id", "key", "value", "description", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'payout.auto_enabled', to_jsonb(true), 'Retrait automatique : le retrait d''un chauffeur est envoyé tout de suite sur son compte Mobile Money, sans validation du support. Désactiver pour revenir à la validation manuelle.', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'payout.auto_max_amount', to_jsonb(0), 'Montant au-dessus duquel un retrait attend quand même une validation de l''équipe (0 = aucune limite). Plus petite unité de la devise du portefeuille.', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
