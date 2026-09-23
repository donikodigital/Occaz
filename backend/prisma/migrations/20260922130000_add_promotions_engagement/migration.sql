-- CreateEnum
CREATE TYPE "PromoDiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'COMPLETED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CookieConsentChoice" AS ENUM ('ACCEPT_ALL', 'REJECT_ALL', 'CUSTOM');

-- AlterTable : code de parrainage, généré à la demande (jamais à l'inscription).
ALTER TABLE "users" ADD COLUMN     "referralCode" TEXT;

-- CreateTable
CREATE TABLE "saved_cards" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "providerToken" TEXT NOT NULL,
    "brand" TEXT,
    "last4" TEXT NOT NULL,
    "expiryMonth" INTEGER NOT NULL,
    "expiryYear" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discountType" "PromoDiscountType" NOT NULL,
    "discountValue" DOUBLE PRECISION NOT NULL,
    "serviceType" "ServiceType",
    "countryId" TEXT,
    "currencyId" TEXT,
    "minAmount" BIGINT,
    "maxDiscountAmount" BIGINT,
    "usageLimit" INTEGER,
    "usageLimitPerUser" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_code_redemptions" (
    "id" TEXT NOT NULL,
    "promoCodeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "bookingId" TEXT,
    "shipmentId" TEXT,
    "discountAmount" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_code_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "refereeId" TEXT NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "rewardAmount" BIGINT,
    "currencyId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "promoCodeId" TEXT,
    "countryId" TEXT,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "coverImageUrl" TEXT,
    "countryId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cookie_consents" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "choice" "CookieConsentChoice" NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "categories" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cookie_consents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_referralCode_key" ON "users"("referralCode");

-- CreateIndex
CREATE INDEX "saved_cards_customerId_idx" ON "saved_cards"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");

-- CreateIndex
CREATE INDEX "promo_codes_isActive_expiresAt_idx" ON "promo_codes"("isActive", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "promo_code_redemptions_bookingId_key" ON "promo_code_redemptions"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "promo_code_redemptions_shipmentId_key" ON "promo_code_redemptions"("shipmentId");

-- CreateIndex
CREATE INDEX "promo_code_redemptions_promoCodeId_idx" ON "promo_code_redemptions"("promoCodeId");

-- CreateIndex
CREATE INDEX "promo_code_redemptions_customerId_idx" ON "promo_code_redemptions"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_refereeId_key" ON "referrals"("refereeId");

-- CreateIndex
CREATE INDEX "referrals_referrerId_status_idx" ON "referrals"("referrerId", "status");

-- CreateIndex
CREATE INDEX "deals_isActive_countryId_idx" ON "deals"("isActive", "countryId");

-- CreateIndex
CREATE INDEX "articles_isActive_publishedAt_idx" ON "articles"("isActive", "publishedAt");

-- CreateIndex
CREATE INDEX "cookie_consents_userId_idx" ON "cookie_consents"("userId");

-- AddForeignKey
ALTER TABLE "saved_cards" ADD CONSTRAINT "saved_cards_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_cards" ADD CONSTRAINT "saved_cards_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "payment_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_code_redemptions" ADD CONSTRAINT "promo_code_redemptions_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "promo_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_code_redemptions" ADD CONSTRAINT "promo_code_redemptions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_code_redemptions" ADD CONSTRAINT "promo_code_redemptions_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_code_redemptions" ADD CONSTRAINT "promo_code_redemptions_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "promo_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cookie_consents" ADD CONSTRAINT "cookie_consents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;