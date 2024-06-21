-- CreateIndex
CREATE INDEX "Tokens_attributes_idx" ON "Tokens" USING GIN ("attributes" jsonb_path_ops);
