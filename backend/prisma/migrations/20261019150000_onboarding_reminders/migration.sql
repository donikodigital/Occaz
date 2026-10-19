-- backend/prisma/migrations/20261019150000_onboarding_reminders/migration.sql
-- CreateTable
CREATE TABLE "onboarding_reminder_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_reminder_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "onboarding_reminder_logs_sentAt_idx" ON "onboarding_reminder_logs"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_reminder_logs_userId_kind_sequence_key" ON "onboarding_reminder_logs"("userId", "kind", "sequence");

-- AddForeignKey
ALTER TABLE "onboarding_reminder_logs" ADD CONSTRAINT "onboarding_reminder_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
