-- CreateIndex
CREATE INDEX "BlockchainEvent_meta_idx" ON "BlockchainEvent" USING GIN ("meta" jsonb_path_ops);

-- CreateIndex
CREATE INDEX "BlockchainEvent_returnValues_idx" ON "BlockchainEvent" USING GIN ("returnValues" jsonb_path_ops);

-- Custom index for sorting by block number.
CREATE INDEX "BlockchainEvent_blockNumber_idx" ON "BlockchainEvent" ((("meta"->'blockNumber')::INT))
