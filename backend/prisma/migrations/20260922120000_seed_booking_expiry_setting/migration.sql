-- Réglage du délai de paiement d'une réservation, rendu visible et modifiable
-- dans l'admin (page « Paramètres »). Passé ce délai (15 minutes par défaut),
-- une réservation jamais payée est annulée et la place restituée — voir
-- BookingExpiryService. Elle est aussi annulée dès que le trajet est parti,
-- quel que soit ce réglage.
-- ON CONFLICT DO NOTHING : une valeur déjà saisie n'est jamais écrasée.
INSERT INTO "platform_settings" ("id", "key", "value", "description", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'booking.unpaid_expiry_minutes', to_jsonb(15), 'Minutes après lesquelles une réservation jamais payée est annulée (au plus tard au départ du trajet)', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;