-- Montant crédité automatiquement au parrain (s'il est chauffeur) à la
-- première prestation confirmée de son filleul — voir
-- ReferralsService.handleFirstPaymentConfirmed. Rendu visible et
-- modifiable dans l'admin (page « Paramètres »).
-- ON CONFLICT DO NOTHING : une valeur déjà saisie n'est jamais écrasée.
INSERT INTO "platform_settings" ("id", "key", "value", "description", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'referral.reward_amount', to_jsonb(10000), 'Montant crédité au parrain (chauffeur) à la première prestation payée de son filleul', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;