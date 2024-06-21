-- AlterTable
ALTER TABLE "Tokens" RENAME COLUMN "minimumOfferId" TO "highestOfferId";

-- AlterTable
ALTER TABLE "Tokens" RENAME COLUMN "minimumOfferPrice" TO "highestOfferPrice";

-- AlterTable
ALTER TABLE "Tokens" RENAME COLUMN "minimumOfferAddressVIP180" TO "highestOfferAddressVIP180";

-- CreateIndex
CREATE INDEX "Tokens_highestOfferPrice_idx" ON "Tokens"("highestOfferPrice");
