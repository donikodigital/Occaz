-- backend/prisma/migrations/20261025200000_devices_unique_push_token/migration.sql
-- [25/10/2026] Notifications reçues plusieurs fois : chaque ouverture de l'application créait une nouvelle ligne « appareil » avec le
-- même token push, et la notification partait une fois par ligne. Un token = un téléphone = une seule ligne.
--
-- 1) Nettoyage de l'existant : pour chaque token présent plusieurs fois, on ne garde le token que sur la ligne la plus récemment vue.
--    Les autres lignes sont conservées (des sessions y sont rattachées) mais n'ont plus de token : elles ne reçoivent plus rien.
UPDATE "devices" AS d
SET "pushToken" = NULL
WHERE d."pushToken" IS NOT NULL
  AND d."id" <> (
    SELECT k."id"
    FROM "devices" AS k
    WHERE k."pushToken" = d."pushToken"
    ORDER BY COALESCE(k."lastSeenAt", k."createdAt") DESC, k."createdAt" DESC, k."id" DESC
    LIMIT 1
  );

-- 2) Garde-fou : la base refuse désormais deux lignes avec le même token (plusieurs lignes sans token restent permises).
CREATE UNIQUE INDEX "devices_pushToken_key" ON "devices"("pushToken");
