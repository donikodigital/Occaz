-- backend/prisma/migrations/20261030150000_user_language/migration.sql
-- Langue choisie par la personne dans l'application (fr, en-GB, pt-PT) : notifications, SMS, e-mails et messages d'erreur du serveur.
ALTER TABLE "users" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'fr';
