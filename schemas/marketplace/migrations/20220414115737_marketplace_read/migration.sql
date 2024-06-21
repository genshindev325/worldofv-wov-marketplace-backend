-- EnableExtension
CREATE EXTENSION IF NOT EXISTS citext SCHEMA pg_catalog;

-- CreateEnum
CREATE TYPE "UsersVerifiedStatus" AS ENUM ('NOT_VERIFIED', 'VERIFIED', 'CURATED');

-- CreateEnum
CREATE TYPE "TokensCategory" AS ENUM ('ART', 'PFP', 'PHOTO', 'MUSIC', 'GAME', 'COLLECTIBLE', 'TRADING_CARD', 'SPORT', 'UTILITY', 'MEME', 'OTHER');

-- CreateEnum
CREATE TYPE "CollectionsType" AS ENUM ('UNKNOWN', 'MARKETPLACE', 'EXTERNAL');

-- CreateTable
CREATE TABLE "Tokens" (
    "tokenId" TEXT NOT NULL,
    "smartContractAddress" CITEXT NOT NULL,
    "name" TEXT NOT NULL,
    "creatorAddress" CITEXT NOT NULL,
    "editionsCount" INTEGER NOT NULL,
    "editionsOnSale" INTEGER DEFAULT 0,
    "editionsInGraveyard" INTEGER DEFAULT 0,
    "categories" "TokensCategory"[],
    "attributes" JSONB,
    "score" DOUBLE PRECISION,
    "rank" INTEGER,
    "collectionId" UUID,
    "fileType" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "media" JSONB,
    "minimumSaleId" TEXT,
    "minimumSalePrice" DECIMAL(78,0),
    "minimumSaleAddressVIP180" CITEXT,
    "minimumOfferId" TEXT,
    "minimumOfferPrice" DECIMAL(78,0),
    "minimumOfferAddressVIP180" CITEXT,
    "minimumAuctionId" TEXT,
    "minimumAuctionReservePrice" DECIMAL(78,0),
    "minimumAuctionHighestBid" DECIMAL(78,0),
    "minimumAuctionAddressVIP180" CITEXT,
    "minimumAuctionEndTime" TIMESTAMPTZ,
    "mintedAt" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tokens_pkey" PRIMARY KEY ("tokenId","smartContractAddress")
);

-- CreateTable
CREATE TABLE "Editions" (
    "tokenId" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "smartContractAddress" CITEXT NOT NULL,
    "ownerAddress" CITEXT NOT NULL,
    "saleId" TEXT,
    "salePrice" DECIMAL(78,0),
    "saleAddressVIP180" CITEXT,
    "minimumOfferId" TEXT,
    "minimumOfferPrice" DECIMAL(78,0),
    "minimumOfferAddressVIP180" CITEXT,
    "auctionId" TEXT,
    "auctionReservePrice" DECIMAL(78,0),
    "auctionHighestBid" DECIMAL(78,0),
    "auctionAddressVIP180" CITEXT,
    "auctionEndTime" TIMESTAMPTZ,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Editions_pkey" PRIMARY KEY ("tokenId","editionId","smartContractAddress")
);

-- CreateTable
CREATE TABLE "Collections" (
    "collectionId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "blockchainId" TEXT,
    "smartContractAddress" TEXT,
    "creatorAddress" CITEXT,
    "name" TEXT NOT NULL,
    "customUrl" CITEXT,
    "thumbnailImageUrl" TEXT,
    "placeholderImageUrl" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isVisible" BOOLEAN NOT NULL DEFAULT false,
    "isRevealed" BOOLEAN NOT NULL DEFAULT false,
    "type" "CollectionsType" NOT NULL DEFAULT E'UNKNOWN',
    "importedAt" TIMESTAMP(3),

    CONSTRAINT "Collections_pkey" PRIMARY KEY ("collectionId")
);

-- CreateTable
CREATE TABLE "Users" (
    "address" CITEXT NOT NULL,
    "name" CITEXT,
    "customUrl" TEXT,
    "ipfsFileHash" TEXT,
    "profileImageUrl" TEXT,
    "blacklisted" BOOLEAN NOT NULL DEFAULT false,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedLevel" "UsersVerifiedStatus" NOT NULL DEFAULT E'NOT_VERIFIED',

    CONSTRAINT "Users_pkey" PRIMARY KEY ("address")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tokens_minimumSaleId_key" ON "Tokens"("minimumSaleId");

-- CreateIndex
CREATE UNIQUE INDEX "Tokens_minimumAuctionId_key" ON "Tokens"("minimumAuctionId");

-- CreateIndex
CREATE INDEX "Tokens_smartContractAddress_idx" ON "Tokens"("smartContractAddress");

-- CreateIndex
CREATE INDEX "Tokens_name_idx" ON "Tokens"("name");

-- CreateIndex
CREATE INDEX "Tokens_creatorAddress_idx" ON "Tokens"("creatorAddress");

-- CreateIndex
CREATE INDEX "Tokens_editionsCount_idx" ON "Tokens"("editionsCount");

-- CreateIndex
CREATE INDEX "Tokens_editionsOnSale_idx" ON "Tokens"("editionsOnSale");

-- CreateIndex
CREATE INDEX "Tokens_editionsInGraveyard_idx" ON "Tokens"("editionsInGraveyard");

-- CreateIndex
CREATE INDEX "Tokens_categories_idx" ON "Tokens"("categories");

-- CreateIndex
CREATE INDEX "Tokens_score_idx" ON "Tokens"("score");

-- CreateIndex
CREATE INDEX "Tokens_rank_idx" ON "Tokens"("rank");

-- CreateIndex
CREATE INDEX "Tokens_collectionId_idx" ON "Tokens"("collectionId");

-- CreateIndex
CREATE INDEX "Tokens_minimumSalePrice_idx" ON "Tokens"("minimumSalePrice");

-- CreateIndex
CREATE INDEX "Tokens_minimumAuctionReservePrice_idx" ON "Tokens"("minimumAuctionReservePrice");

-- CreateIndex
CREATE INDEX "Tokens_minimumAuctionHighestBid_idx" ON "Tokens"("minimumAuctionHighestBid");

-- CreateIndex
CREATE INDEX "Tokens_minimumSalePrice_minimumAuctionReservePrice_minimumA_idx" ON "Tokens"("minimumSalePrice", "minimumAuctionReservePrice", "minimumAuctionHighestBid");

-- CreateIndex
CREATE INDEX "Tokens_minimumSaleAddressVIP180_minimumAuctionAddressVIP180_idx" ON "Tokens"("minimumSaleAddressVIP180", "minimumAuctionAddressVIP180");

-- CreateIndex
CREATE INDEX "Tokens_mintedAt_idx" ON "Tokens"("mintedAt");

-- CreateIndex
CREATE INDEX "Tokens_updatedAt_idx" ON "Tokens"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Editions_saleId_key" ON "Editions"("saleId");

-- CreateIndex
CREATE UNIQUE INDEX "Editions_auctionId_key" ON "Editions"("auctionId");

-- CreateIndex
CREATE INDEX "Editions_smartContractAddress_idx" ON "Editions"("smartContractAddress");

-- CreateIndex
CREATE INDEX "Editions_tokenId_smartContractAddress_idx" ON "Editions"("tokenId", "smartContractAddress");

-- CreateIndex
CREATE INDEX "Editions_editionId_smartContractAddress_idx" ON "Editions"("editionId", "smartContractAddress");

-- CreateIndex
CREATE INDEX "Editions_ownerAddress_idx" ON "Editions"("ownerAddress");

-- CreateIndex
CREATE INDEX "Editions_saleId_idx" ON "Editions"("saleId");

-- CreateIndex
CREATE INDEX "Editions_salePrice_idx" ON "Editions"("salePrice");

-- CreateIndex
CREATE INDEX "Editions_saleAddressVIP180_idx" ON "Editions"("saleAddressVIP180");

-- CreateIndex
CREATE INDEX "Editions_minimumOfferId_idx" ON "Editions"("minimumOfferId");

-- CreateIndex
CREATE INDEX "Editions_minimumOfferPrice_idx" ON "Editions"("minimumOfferPrice");

-- CreateIndex
CREATE INDEX "Editions_minimumOfferAddressVIP180_idx" ON "Editions"("minimumOfferAddressVIP180");

-- CreateIndex
CREATE INDEX "Editions_auctionId_idx" ON "Editions"("auctionId");

-- CreateIndex
CREATE INDEX "Editions_auctionReservePrice_idx" ON "Editions"("auctionReservePrice");

-- CreateIndex
CREATE INDEX "Editions_auctionHighestBid_idx" ON "Editions"("auctionHighestBid");

-- CreateIndex
CREATE INDEX "Editions_auctionAddressVIP180_idx" ON "Editions"("auctionAddressVIP180");

-- CreateIndex
CREATE INDEX "Editions_auctionEndTime_idx" ON "Editions"("auctionEndTime");

-- CreateIndex
CREATE INDEX "Editions_salePrice_auctionReservePrice_auctionHighestBid_idx" ON "Editions"("salePrice", "auctionReservePrice", "auctionHighestBid");

-- CreateIndex
CREATE INDEX "Editions_saleAddressVIP180_auctionAddressVIP180_idx" ON "Editions"("saleAddressVIP180", "auctionAddressVIP180");

-- CreateIndex
CREATE INDEX "Editions_updatedAt_idx" ON "Editions"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Collections_blockchainId_key" ON "Collections"("blockchainId");

-- CreateIndex
CREATE UNIQUE INDEX "Collections_smartContractAddress_key" ON "Collections"("smartContractAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Collections_customUrl_key" ON "Collections"("customUrl");

-- CreateIndex
CREATE INDEX "Collections_blockchainId_idx" ON "Collections"("blockchainId");

-- CreateIndex
CREATE INDEX "Collections_smartContractAddress_idx" ON "Collections"("smartContractAddress");

-- CreateIndex
CREATE INDEX "Collections_creatorAddress_idx" ON "Collections"("creatorAddress");

-- CreateIndex
CREATE INDEX "Collections_isVerified_idx" ON "Collections"("isVerified");

-- CreateIndex
CREATE INDEX "Collections_isVisible_idx" ON "Collections"("isVisible");

-- CreateIndex
CREATE INDEX "Collections_isRevealed_idx" ON "Collections"("isRevealed");

-- CreateIndex
CREATE INDEX "Collections_type_idx" ON "Collections"("type");

-- CreateIndex
CREATE INDEX "Users_name_idx" ON "Users"("name");

-- CreateIndex
CREATE INDEX "Users_blacklisted_idx" ON "Users"("blacklisted");

-- CreateIndex
CREATE INDEX "Users_verified_idx" ON "Users"("verified");

-- CreateIndex
CREATE INDEX "Users_verifiedLevel_idx" ON "Users"("verifiedLevel");
