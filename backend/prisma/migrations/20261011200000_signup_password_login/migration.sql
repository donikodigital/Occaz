-- Inscription en étapes (téléphone, e-mail facultatif, mot de passe à 6 chiffres) et connexion par mot de passe.

-- Nouvelle finalité de code : vérification d'une adresse e-mail.
ALTER TYPE "OtpPurpose" ADD VALUE IF NOT EXISTS 'EMAIL_VERIFICATION';

-- Comptes : e-mail vérifié, compteur d'erreurs de mot de passe et verrouillage temporaire.
ALTER TABLE "users"
  ADD COLUMN "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockedUntil" TIMESTAMP(3);

-- Pays présélectionné à l'inscription.
ALTER TABLE "countries" ADD COLUMN "isSignupDefault" BOOLEAN NOT NULL DEFAULT false;

-- Adresse e-mail en cours de vérification, portée par le code.
ALTER TABLE "otp_codes" ADD COLUMN "target" TEXT;
