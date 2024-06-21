/*
  Warnings:

  - The `updatedAt` column on the `Editions` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `updatedAt` column on the `Tokens` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Collections" ADD COLUMN     "createdAt" INTEGER,
ADD COLUMN     "updatedAt" INTEGER;

-- AlterTable
ALTER TABLE "Editions" DROP COLUMN "updatedAt",
ADD COLUMN     "updatedAt" INTEGER;

-- AlterTable
ALTER TABLE "Tokens" DROP COLUMN "updatedAt",
ADD COLUMN     "updatedAt" INTEGER;

-- CreateIndex
CREATE INDEX "Collections_createdAt_idx" ON "Collections"("createdAt");

-- CreateIndex
CREATE INDEX "Collections_updatedAt_idx" ON "Collections"("updatedAt");

-- CreateIndex
CREATE INDEX "Editions_updatedAt_idx" ON "Editions"("updatedAt");

-- CreateIndex
CREATE INDEX "Tokens_updatedAt_idx" ON "Tokens"("updatedAt");
