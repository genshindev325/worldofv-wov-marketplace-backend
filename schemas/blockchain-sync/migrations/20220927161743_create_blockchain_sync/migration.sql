CREATE EXTENSION IF NOT EXISTS citext;

-- CreateEnum
CREATE TYPE "BlockchainEventStatus" AS ENUM ('SAVED', 'FAILED', 'COMPLETED', 'STOPPED');

-- CreateTable
CREATE TABLE "BlockchainEvent" (
    "jobId" TEXT NOT NULL,
    "address" CITEXT NOT NULL,
    "event" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "returnValues" JSONB NOT NULL,
    "meta" JSONB NOT NULL,
    "raw" JSON NOT NULL,
    "status" "BlockchainEventStatus" NOT NULL,

    CONSTRAINT "BlockchainEvent_pkey" PRIMARY KEY ("jobId")
);

-- CreateIndex
CREATE INDEX "BlockchainEvent_address_idx" ON "BlockchainEvent"("address");

-- CreateIndex
CREATE INDEX "BlockchainEvent_event_idx" ON "BlockchainEvent"("event");

-- CreateIndex
CREATE INDEX "BlockchainEvent_jobId_idx" ON "BlockchainEvent"("jobId");

-- CreateIndex
CREATE INDEX "BlockchainEvent_status_idx" ON "BlockchainEvent"("status");
