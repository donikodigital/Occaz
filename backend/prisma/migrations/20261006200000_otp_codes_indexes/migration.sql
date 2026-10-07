-- Plafonds de codes SMS : comptages par numéro (userId, purpose, createdAt) et pour toute la plateforme (purpose, createdAt).
-- Sans ces index, chaque demande de code parcourait toute la table otp_codes.

-- CreateIndex
CREATE INDEX "otp_codes_userId_purpose_createdAt_idx" ON "otp_codes"("userId", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "otp_codes_purpose_createdAt_idx" ON "otp_codes"("purpose", "createdAt");
