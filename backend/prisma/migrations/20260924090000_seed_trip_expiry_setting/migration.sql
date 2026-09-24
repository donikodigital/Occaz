-- Délai après lequel un trajet publié (ou "chauffeur arrivé"), sans
-- aucune réservation, est annulé automatiquement — voir TripExpiryService.
-- Rendu visible et modifiable dans l'admin (page « Paramètres »).
-- ON CONFLICT DO NOTHING : une valeur déjà saisie n'est jamais écrasée.
INSERT INTO "platform_settings" ("id", "key", "value", "description", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'trip.stale_expiry_hours', to_jsonb(24), 'Heures après le départ au-delà desquelles un trajet publié sans réservation est annulé automatiquement', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;