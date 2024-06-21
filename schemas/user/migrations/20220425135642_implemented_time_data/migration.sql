-- AlterTable
ALTER TABLE "User" ADD COLUMN     "createdAt" INTEGER,
ADD COLUMN     "updatedAt" INTEGER;

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "User_updatedAt_idx" ON "User"("updatedAt");

-- RenameIndex
ALTER INDEX "User_customUrl_idx" RENAME TO "User_customUrl_key";
