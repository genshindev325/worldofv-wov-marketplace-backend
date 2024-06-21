-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "createdAt" INTEGER,
ADD COLUMN     "updatedAt" INTEGER;

-- CreateIndex
CREATE INDEX "Sale_createdAt_idx" ON "Sale"("createdAt");

-- CreateIndex
CREATE INDEX "Sale_updatedAt_idx" ON "Sale"("updatedAt");
