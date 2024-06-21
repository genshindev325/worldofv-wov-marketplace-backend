-- EnableExtension
CREATE EXTENSION IF NOT EXISTS citext SCHEMA pg_catalog;

-- CreateEnum
CREATE TYPE "TokenCategory" AS ENUM ('ART', 'PFP', 'PHOTO', 'MUSIC', 'GAME', 'COLLECTIBLE', 'TRADING_CARD', 'SPORT', 'UTILITY', 'MEME', 'OTHER');

-- CreateEnum
CREATE TYPE "CollectionType" AS ENUM ('UNKNOWN', 'MARKETPLACE', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "ImportType" AS ENUM ('UNKNOWN', 'SMART_CONTRACT', 'VESEA');

-- CreateTable
CREATE TABLE "Token" (
    "tokenId" TEXT NOT NULL,
    "smartContractAddress" CITEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "creatorAddress" CITEXT NOT NULL,
    "editionsCount" INTEGER NOT NULL,
    "royalty" DOUBLE PRECISION NOT NULL,
    "categories" "TokenCategory"[],
    "attributes" JSONB,
    "score" DOUBLE PRECISION,
    "rank" INTEGER,
    "collectionId" UUID,
    "fileType" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "metadataUrl" TEXT NOT NULL,
    "mintedAt" INTEGER NOT NULL,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("tokenId","smartContractAddress")
);

-- CreateTable
CREATE TABLE "Edition" (
    "tokenId" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "smartContractAddress" CITEXT NOT NULL,
    "ownerAddress" CITEXT NOT NULL,

    CONSTRAINT "Edition_pkey" PRIMARY KEY ("editionId","smartContractAddress")
);

-- CreateTable
CREATE TABLE "Collection" (
    "collectionId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "blockchainId" TEXT,
    "smartContractAddress" TEXT,
    "creatorAddress" CITEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "customUrl" CITEXT,
    "mintPageUrl" TEXT,
    "thumbnailImageUrl" TEXT,
    "bannerImageUrl" TEXT,
    "placeholderImageUrl" TEXT,
    "minimumOffer" DECIMAL(78,0),
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "isMinting" BOOLEAN NOT NULL DEFAULT false,
    "isRevealed" BOOLEAN NOT NULL DEFAULT true,
    "type" "CollectionType" NOT NULL DEFAULT E'UNKNOWN',
    "importType" "ImportType",
    "importedAt" TIMESTAMP,
    "config" JSONB,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("collectionId")
);

-- CreateIndex
CREATE INDEX "Token_smartContractAddress_idx" ON "Token"("smartContractAddress");

-- CreateIndex
CREATE INDEX "Token_name_idx" ON "Token"("name");

-- CreateIndex
CREATE INDEX "Token_creatorAddress_idx" ON "Token"("creatorAddress");

-- CreateIndex
CREATE INDEX "Token_categories_idx" ON "Token"("categories");

-- CreateIndex
CREATE INDEX "Token_score_idx" ON "Token"("score");

-- CreateIndex
CREATE INDEX "Token_rank_idx" ON "Token"("rank");

-- CreateIndex
CREATE INDEX "Token_collectionId_idx" ON "Token"("collectionId");

-- CreateIndex
CREATE INDEX "Token_mintedAt_idx" ON "Token"("mintedAt");

-- CreateIndex
CREATE INDEX "Edition_tokenId_smartContractAddress_idx" ON "Edition"("tokenId", "smartContractAddress");

-- CreateIndex
CREATE INDEX "Edition_tokenId_editionId_smartContractAddress_idx" ON "Edition"("tokenId", "editionId", "smartContractAddress");

-- CreateIndex
CREATE INDEX "Edition_ownerAddress_idx" ON "Edition"("ownerAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_blockchainId_key" ON "Collection"("blockchainId");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_smartContractAddress_key" ON "Collection"("smartContractAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_customUrl_key" ON "Collection"("customUrl");

-- CreateIndex
CREATE INDEX "Collection_blockchainId_idx" ON "Collection"("blockchainId");

-- CreateIndex
CREATE INDEX "Collection_smartContractAddress_idx" ON "Collection"("smartContractAddress");

-- CreateIndex
CREATE INDEX "Collection_creatorAddress_idx" ON "Collection"("creatorAddress");

-- CreateIndex
CREATE INDEX "Collection_isVerified_idx" ON "Collection"("isVerified");

-- CreateIndex
CREATE INDEX "Collection_isVisible_idx" ON "Collection"("isVisible");

-- CreateIndex
CREATE INDEX "Collection_isRevealed_idx" ON "Collection"("isRevealed");

-- CreateIndex
CREATE INDEX "Collection_isMinting_idx" ON "Collection"("isMinting");

-- CreateIndex
CREATE INDEX "Collection_type_idx" ON "Collection"("type");

-- CreateIndex
CREATE INDEX "Collection_config_idx" ON "Collection"("config");

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("collectionId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Edition" ADD CONSTRAINT "Edition_tokenId_smartContractAddress_fkey" FOREIGN KEY ("tokenId", "smartContractAddress") REFERENCES "Token"("tokenId", "smartContractAddress") ON DELETE CASCADE ON UPDATE CASCADE;
