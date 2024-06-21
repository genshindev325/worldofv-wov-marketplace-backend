/*
  Warnings:

  - The values [UNKNOWN,EXPIRED] on the enum `OfferStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [UNKNOWN] on the enum `OfferType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "OfferStatus_new" AS ENUM ('ACTIVE', 'ACCEPTED', 'CANCELLED');
ALTER TABLE "Offer" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Offer" ALTER COLUMN "status" TYPE "OfferStatus_new" USING ("status"::text::"OfferStatus_new");
ALTER TYPE "OfferStatus" RENAME TO "OfferStatus_old";
ALTER TYPE "OfferStatus_new" RENAME TO "OfferStatus";
DROP TYPE "OfferStatus_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "OfferType_new" AS ENUM ('EDITION', 'TOKEN', 'COLLECTION');
ALTER TABLE "Offer" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "Offer" ALTER COLUMN "type" TYPE "OfferType_new" USING ("type"::text::"OfferType_new");
ALTER TYPE "OfferType" RENAME TO "OfferType_old";
ALTER TYPE "OfferType_new" RENAME TO "OfferType";
DROP TYPE "OfferType_old";
COMMIT;

-- AlterTable
ALTER TABLE "Offer" ALTER COLUMN "type" DROP DEFAULT,
ALTER COLUMN "status" DROP DEFAULT;
