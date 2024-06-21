CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- DropIndex
DROP INDEX "Token_name_idx";

-- CreateIndex
CREATE INDEX "Collection_name_idx" ON "Collection" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Token_name_idx" ON "Token" USING GIN ("name" gin_trgm_ops);
