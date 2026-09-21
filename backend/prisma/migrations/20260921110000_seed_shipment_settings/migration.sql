-- Réglages des envois rendus visibles et modifiables dans l'admin (page « Paramètres », groupe « Envois »).
-- Valeurs identiques aux valeurs par défaut déjà utilisées par le code : rien ne change tant que tu ne les modifies pas.
-- ON CONFLICT DO NOTHING : une valeur que tu avais déjà saisie n'est jamais écrasée.
INSERT INTO "platform_settings" ("id", "key", "value", "description", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'shipment.base_price', to_jsonb(2000), 'Prix de base d’un envoi, avant poids et distance', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'shipment.price_per_kg', to_jsonb(1000), 'Prix par kilo facturé (le plus grand du poids réel et du poids volumétrique)', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'shipment.price_per_km', to_jsonb(300), 'Prix par kilomètre parcouru', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'shipment.urgent_surcharge', to_jsonb(5000), 'Majoration ajoutée pour un envoi urgent', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'shipment.volumetric_divisor', to_jsonb(5000), 'Poids volumétrique : longueur × largeur × hauteur (cm) divisée par ce nombre donne des kilos', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'shipment.road_distance_factor', to_jsonb(1.3), 'Coefficient appliqué à la distance à vol d’oiseau pour approcher la distance par la route', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'shipment.declared_value_rate_percent', to_jsonb(1), 'Frais sur la valeur déclarée d’un colis, en pourcentage de cette valeur', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'shipment.declared_value_min_fee', to_jsonb(0), 'Frais minimum sur la valeur déclarée (0 = aucun minimum)', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'shipment.extension_grace_hours', to_jsonb(24), 'Heures laissées au client pour prolonger une demande restée sans chauffeur, avant le remboursement automatique', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'shipment.unpaid_expiry_hours', to_jsonb(24), 'Heures après lesquelles un envoi jamais payé est annulé', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'shipment.dispatch_email_enabled', to_jsonb(1), 'Prévenir aussi les chauffeurs par e-mail d’une nouvelle demande d’envoi (1 = oui, 0 = notification seulement)', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;