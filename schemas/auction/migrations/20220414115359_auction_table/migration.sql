-- EnableExtension
CREATE EXTENSION IF NOT EXISTS citext SCHEMA pg_catalog;

-- CreateEnum
CREATE TYPE "AuctionStatus" AS ENUM ('UNKNOWN', 'ACTIVE', 'CANCELLED', 'TO_SETTLE', 'SETTLED');

-- CreateTable
CREATE TABLE "Auction" (
    "auctionId" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "smartContractAddress" CITEXT NOT NULL,
    "sellerAddress" CITEXT NOT NULL,
    "settlorAddress" CITEXT,
    "highestBidderAddress" CITEXT,
    "reservePrice" DECIMAL(78,0) NOT NULL,
    "highestBid" DECIMAL(78,0),
    "addressVIP180" CITEXT,
    "startingTime" TIMESTAMPTZ NOT NULL,
    "endTime" TIMESTAMPTZ NOT NULL,
    "status" "AuctionStatus" NOT NULL DEFAULT E'UNKNOWN',

    CONSTRAINT "Auction_pkey" PRIMARY KEY ("auctionId")
);

-- CreateIndex
CREATE INDEX "Auction_smartContractAddress_idx" ON "Auction"("smartContractAddress");

-- CreateIndex
CREATE INDEX "Auction_tokenId_smartContractAddress_idx" ON "Auction"("tokenId", "smartContractAddress");

-- CreateIndex
CREATE INDEX "Auction_editionId_smartContractAddress_idx" ON "Auction"("editionId", "smartContractAddress");

-- CreateIndex
CREATE INDEX "Auction_tokenId_editionId_smartContractAddress_idx" ON "Auction"("tokenId", "editionId", "smartContractAddress");

-- CreateIndex
CREATE INDEX "Auction_sellerAddress_idx" ON "Auction"("sellerAddress");

-- CreateIndex
CREATE INDEX "Auction_settlorAddress_idx" ON "Auction"("settlorAddress");

-- CreateIndex
CREATE INDEX "Auction_highestBidderAddress_idx" ON "Auction"("highestBidderAddress");

-- CreateIndex
CREATE INDEX "Auction_reservePrice_idx" ON "Auction"("reservePrice");

-- CreateIndex
CREATE INDEX "Auction_highestBid_idx" ON "Auction"("highestBid");

-- CreateIndex
CREATE INDEX "Auction_addressVIP180_idx" ON "Auction"("addressVIP180");

-- CreateIndex
CREATE INDEX "Auction_startingTime_idx" ON "Auction"("startingTime");

-- CreateIndex
CREATE INDEX "Auction_endTime_idx" ON "Auction"("endTime");

-- CreateIndex
CREATE INDEX "Auction_status_idx" ON "Auction"("status");
