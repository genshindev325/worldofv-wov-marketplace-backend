-- EnableExtension
CREATE EXTENSION IF NOT EXISTS citext SCHEMA pg_catalog;

-- CreateEnum
CREATE TYPE "VerifiedStatus" AS ENUM ('NOT_VERIFIED', 'VERIFIED', 'CURATED');

-- CreateEnum
CREATE TYPE "ProfileTabs" AS ENUM ('COLLECTED', 'CREATED', 'ON_SALE', 'COLLECTIONS');

-- CreateTable
CREATE TABLE "User" (
    "address" CITEXT NOT NULL,
    "profileId" INTEGER,
    "name" CITEXT,
    "description" CITEXT,
    "email" CITEXT,
    "customUrl" CITEXT,
    "websiteUrl" TEXT,
    "facebookUrl" TEXT,
    "twitterUrl" TEXT,
    "instagramUrl" TEXT,
    "discordUrl" TEXT,
    "ipfsFileHash" TEXT,
    "ipfsMetadataHash" TEXT,
    "blacklisted" BOOLEAN NOT NULL DEFAULT false,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedLevel" "VerifiedStatus" NOT NULL DEFAULT E'NOT_VERIFIED',
    "profileImageUrl" TEXT,
    "bannerImageUrl" TEXT,
    "landingTab" "ProfileTabs",
    "showEmail" BOOLEAN NOT NULL DEFAULT false,
    "showBalance" BOOLEAN NOT NULL DEFAULT false,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isEmailNotificationEnabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("address")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_profileId_key" ON "User"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_name_idx" ON "User"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_customUrl_idx" ON "User"("customUrl");

-- CreateIndex
CREATE INDEX "User_blacklisted_idx" ON "User"("blacklisted");

-- CreateIndex
CREATE INDEX "User_verified_idx" ON "User"("verified");

-- CreateIndex
CREATE INDEX "User_verifiedLevel_idx" ON "User"("verifiedLevel");
