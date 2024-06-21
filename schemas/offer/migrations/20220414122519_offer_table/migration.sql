-- EnableExtension
CREATE EXTENSION IF NOT EXISTS citext SCHEMA pg_catalog;

-- CreateEnum
CREATE TYPE "OfferType" AS ENUM ('UNKNOWN', 'EDITION', 'TOKEN', 'COLLECTION');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('UNKNOWN', 'ACTIVE', 'ACCEPTED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Offer" (
    "offerId" TEXT NOT NULL,
    "tokenId" TEXT,
    "editionId" TEXT,
    "smartContractAddress" CITEXT NOT NULL,
    "bidderAddress" CITEXT NOT NULL,
    "acceptorAddress" CITEXT,
    "price" DECIMAL(78,0) NOT NULL,
    "addressVIP180" CITEXT,
    "startingTime" TIMESTAMPTZ NOT NULL,
    "endTime" TIMESTAMPTZ NOT NULL,
    "type" "OfferType" NOT NULL DEFAULT E'UNKNOWN',
    "status" "OfferStatus" NOT NULL DEFAULT E'UNKNOWN',

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("offerId")
);

-- CreateIndex
CREATE INDEX "Offer_smartContractAddress_idx" ON "Offer"("smartContractAddress");

-- CreateIndex
CREATE INDEX "Offer_tokenId_smartContractAddress_idx" ON "Offer"("tokenId", "smartContractAddress");

-- CreateIndex
CREATE INDEX "Offer_editionId_smartContractAddress_idx" ON "Offer"("editionId", "smartContractAddress");

-- CreateIndex
CREATE INDEX "Offer_tokenId_editionId_smartContractAddress_idx" ON "Offer"("tokenId", "editionId", "smartContractAddress");

-- CreateIndex
CREATE INDEX "Offer_bidderAddress_idx" ON "Offer"("bidderAddress");

-- CreateIndex
CREATE INDEX "Offer_acceptorAddress_idx" ON "Offer"("acceptorAddress");

-- CreateIndex
CREATE INDEX "Offer_price_idx" ON "Offer"("price");

-- CreateIndex
CREATE INDEX "Offer_addressVIP180_idx" ON "Offer"("addressVIP180");

-- CreateIndex
CREATE INDEX "Offer_startingTime_idx" ON "Offer"("startingTime");

-- CreateIndex
CREATE INDEX "Offer_endTime_idx" ON "Offer"("endTime");

-- CreateIndex
CREATE INDEX "Offer_type_idx" ON "Offer"("type");

-- CreateIndex
CREATE INDEX "Offer_status_idx" ON "Offer"("status");
