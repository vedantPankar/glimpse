-- AlterTable
ALTER TABLE "VideoEvent" ADD COLUMN     "deviceType" TEXT,
ADD COLUMN     "placement" TEXT;

-- CreateIndex
CREATE INDEX "VideoEvent_shop_createdAt_idx" ON "VideoEvent"("shop", "createdAt");
