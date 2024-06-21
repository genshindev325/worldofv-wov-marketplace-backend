-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('UNKNOWN', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "TemplateKey" AS ENUM ('AUCTION_ENDING_SOON', 'AUCTION_OUTBID', 'AUCTION_BID_CONFIRMED', 'AUCTION_WON', 'AUCTION_SETTLED', 'AUCTION_NFT_SOLD', 'AUCTION_NFT_NOT_SOLD', 'AUCTION_CREATED', 'OFFER_RECEIVED', 'OFFER_ACCEPTED');

-- CreateTable
CREATE TABLE "Templates" (
    "key" "TemplateKey" NOT NULL,
    "templateId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Templates_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Email" (
    "id" TEXT NOT NULL,
    "key" "TemplateKey" NOT NULL,
    "data" JSONB,
    "status" "EmailStatus" NOT NULL DEFAULT E'UNKNOWN',
    "failedReason" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Email_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Templates_templateId_key" ON "Templates"("templateId");
