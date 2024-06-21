-- AlterTable
ALTER TABLE "Auction" ADD COLUMN     "createdAt" INTEGER,
ADD COLUMN     "updatedAt" INTEGER;

-- CreateIndex
CREATE INDEX "Auction_createdAt_idx" ON "Auction"("createdAt");

-- CreateIndex
CREATE INDEX "Auction_updatedAt_idx" ON "Auction"("updatedAt");
