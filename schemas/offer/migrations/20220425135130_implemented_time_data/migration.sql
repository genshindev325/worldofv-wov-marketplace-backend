-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "createdAt" INTEGER,
ADD COLUMN     "updatedAt" INTEGER;

-- CreateIndex
CREATE INDEX "Offer_createdAt_idx" ON "Offer"("createdAt");

-- CreateIndex
CREATE INDEX "Offer_updatedAt_idx" ON "Offer"("updatedAt");
