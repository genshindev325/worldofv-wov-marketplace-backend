-- AlterTable
ALTER TABLE "Editions" ADD COLUMN     "lastListedAt" INTEGER,
ADD COLUMN     "lastTransferredAt" INTEGER;

-- CreateIndex
CREATE INDEX "Editions_lastListedAt_idx" ON "Editions"("lastListedAt");

-- CreateIndex
CREATE INDEX "Editions_lastTransferredAt_idx" ON "Editions"("lastTransferredAt");
