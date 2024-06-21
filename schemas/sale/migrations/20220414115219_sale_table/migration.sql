-- EnableExtension
CREATE EXTENSION IF NOT EXISTS citext SCHEMA pg_catalog;

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('UNKNOWN', 'LISTED', 'PURCHASED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Sale" (
    "saleId" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "smartContractAddress" CITEXT NOT NULL,
    "sellerAddress" CITEXT NOT NULL,
    "buyerAddress" CITEXT,
    "price" DECIMAL(78,0) NOT NULL,
    "addressVIP180" CITEXT,
    "startingTime" TIMESTAMPTZ NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT E'UNKNOWN',

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("saleId")
);

-- CreateIndex
CREATE INDEX "Sale_smartContractAddress_idx" ON "Sale"("smartContractAddress");

-- CreateIndex
CREATE INDEX "Sale_tokenId_smartContractAddress_idx" ON "Sale"("tokenId", "smartContractAddress");

-- CreateIndex
CREATE INDEX "Sale_editionId_smartContractAddress_idx" ON "Sale"("editionId", "smartContractAddress");

-- CreateIndex
CREATE INDEX "Sale_tokenId_editionId_smartContractAddress_idx" ON "Sale"("tokenId", "editionId", "smartContractAddress");

-- CreateIndex
CREATE INDEX "Sale_sellerAddress_idx" ON "Sale"("sellerAddress");

-- CreateIndex
CREATE INDEX "Sale_buyerAddress_idx" ON "Sale"("buyerAddress");

-- CreateIndex
CREATE INDEX "Sale_price_idx" ON "Sale"("price");

-- CreateIndex
CREATE INDEX "Sale_addressVIP180_idx" ON "Sale"("addressVIP180");

-- CreateIndex
CREATE INDEX "Sale_startingTime_idx" ON "Sale"("startingTime");

-- CreateIndex
CREATE INDEX "Sale_status_idx" ON "Sale"("status");
