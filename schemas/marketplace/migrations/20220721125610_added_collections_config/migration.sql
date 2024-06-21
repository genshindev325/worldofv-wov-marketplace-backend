-- AlterTable
ALTER TABLE "Collections" ADD COLUMN     "config" JSONB;

-- CreateIndex
CREATE INDEX "Collections_config_idx" ON "Collections"("config");
