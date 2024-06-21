-- AlterTable
ALTER TABLE "Tokens" ADD COLUMN     "lastTransferredAt" INTEGER;

-- CreateIndex
CREATE INDEX "Tokens_lastTransferredAt_idx" ON "Tokens"("lastTransferredAt");
