-- EnableExtension
CREATE EXTENSION IF NOT EXISTS citext SCHEMA pg_catalog;

-- CreateTable
CREATE TABLE "VerifiedDrop" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "position" SMALLINT NOT NULL,
    "dateTime" TIMESTAMP(3) NOT NULL,
    "title" TEXT,
    "imageUrl" TEXT,
    "address" CITEXT,
    "collectionId" TEXT,
    "tokenId" TEXT,

    CONSTRAINT "VerifiedDrop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VerifiedDrop_collectionId_key" ON "VerifiedDrop"("collectionId");

-- CreateIndex
CREATE UNIQUE INDEX "VerifiedDrop_tokenId_key" ON "VerifiedDrop"("tokenId");

-- CreateIndex
CREATE INDEX "VerifiedDrop_position_idx" ON "VerifiedDrop"("position");
