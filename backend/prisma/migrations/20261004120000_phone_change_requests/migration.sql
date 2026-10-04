-- CreateTable
CREATE TABLE "phone_change_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "oldPhone" TEXT NOT NULL,
    "newPhone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "status" "OtpStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "phone_change_requests_userId_createdAt_idx" ON "phone_change_requests"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "phone_change_requests_newPhone_createdAt_idx" ON "phone_change_requests"("newPhone", "createdAt");

-- AddForeignKey
ALTER TABLE "phone_change_requests" ADD CONSTRAINT "phone_change_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
