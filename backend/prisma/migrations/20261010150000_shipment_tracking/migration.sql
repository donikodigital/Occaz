-- Suivi des colis : e-mail facultatif du destinataire, et recherche rapide d'un envoi par son numéro de suivi public.
ALTER TABLE "shipments" ADD COLUMN "recipientEmail" TEXT;

-- Le numéro de suivi (« OCZ » + 10 premiers caractères de l'identifiant, sans tirets, en majuscules) n'est pas stocké : cet index
-- sur la même expression sert la recherche publique par numéro sans table supplémentaire.
CREATE INDEX "shipments_tracking_number_idx" ON "shipments" (upper(substr(replace("id", '-', ''), 1, 10)));
