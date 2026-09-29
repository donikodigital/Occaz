-- AlterEnum
ALTER TYPE "DisputeResolutionType" ADD VALUE 'OTP_MANUAL_VALIDATION';

-- AlterTable
ALTER TABLE "dispute_resolutions" ADD COLUMN "otpPurpose" "OtpPurpose";