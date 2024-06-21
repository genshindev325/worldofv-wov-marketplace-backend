-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "createdAt" INTEGER,
ADD COLUMN     "updatedAt" INTEGER;

-- AlterTable
ALTER TABLE "Edition" ADD COLUMN     "updatedAt" INTEGER;

-- CreateIndex
CREATE INDEX "Collection_createdAt_idx" ON "Collection"("createdAt");

-- CreateIndex
CREATE INDEX "Collection_updatedAt_idx" ON "Collection"("updatedAt");

-- CreateIndex
CREATE INDEX "Edition_updatedAt_idx" ON "Edition"("updatedAt");
