-- EnableExtension
CREATE EXTENSION IF NOT EXISTS citext SCHEMA pg_catalog;

-- CreateEnum
CREATE TYPE "Interval" AS ENUM ('H24', 'D7', 'D30', 'ALL');

-- CreateEnum
CREATE TYPE "Marketplace" AS ENUM ('WOV', 'VESEA', 'OTHER');

-- CreateTable
CREATE TABLE "Collections" (
    "id" TEXT NOT NULL,
    "contractAddress" CITEXT NOT NULL,
    "collectionSize" INTEGER NOT NULL,
    "ownerCount" INTEGER NOT NULL,
    "name" CITEXT,
    "floorPriceVET" TEXT,
    "floorPriceWOV" TEXT,
    "averagePriceVET" TEXT,
    "averagePriceWOV" TEXT,
    "itemsForSale" INTEGER,
    "highestOfferVET" TEXT,
    "highestOfferWOV" TEXT,
    "marketplace" "Marketplace" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleStats" (
    "id" SERIAL NOT NULL,
    "interval" "Interval" NOT NULL,
    "volumeVET" TEXT,
    "volumeWOV" TEXT,
    "itemsSold" INTEGER,
    "distinctItemsSold" INTEGER,
    "percentageChangeVolVET" TEXT,
    "percentageChangeVolWOV" TEXT,
    "percentageChangeItems" TEXT,
    "collectionsId" TEXT NOT NULL,

    CONSTRAINT "SaleStats_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SaleStats" ADD CONSTRAINT "SaleStats_collectionsId_fkey" FOREIGN KEY ("collectionsId") REFERENCES "Collections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
