/*
  Warnings:

  - You are about to drop the column `minimumOfferAddressVIP180` on the `Editions` table. All the data in the column will be lost.
  - You are about to drop the column `minimumOfferId` on the `Editions` table. All the data in the column will be lost.
  - You are about to drop the column `minimumOfferPrice` on the `Editions` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Editions_minimumOfferAddressVIP180_idx";

-- DropIndex
DROP INDEX "Editions_minimumOfferId_idx";

-- DropIndex
DROP INDEX "Editions_minimumOfferPrice_idx";

-- AlterTable
ALTER TABLE "Editions" DROP COLUMN "minimumOfferAddressVIP180",
DROP COLUMN "minimumOfferId",
DROP COLUMN "minimumOfferPrice";
