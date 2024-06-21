CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- DropIndex
DROP INDEX "User_name_idx";

-- CreateIndex
CREATE INDEX "User_name_idx" ON "User" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "User_customUrl_idx" ON "User"("customUrl");
