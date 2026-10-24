-- AlterEnum
ALTER TYPE "FollowUpType" ADD VALUE 'EMIRATES_ID_EXPIRY';

-- AlterTable
ALTER TABLE "FollowUp" ADD COLUMN     "autoKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "FollowUp_autoKey_key" ON "FollowUp"("autoKey");

