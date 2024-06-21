-- AlterTable
ALTER TABLE "Tokens" ADD COLUMN     "lastListedAt" INTEGER;

-- CreateIndex
CREATE INDEX "Tokens_lastListedAt_idx" ON "Tokens"("lastListedAt");
