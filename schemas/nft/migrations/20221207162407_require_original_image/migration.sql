/*
  Warnings:

  - Made the column `imageMimeType` on table `Token` required. This step will fail if there are existing NULL values in that column.
  - Made the column `imageUrl` on table `Token` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Token" ALTER COLUMN "imageMimeType" SET NOT NULL,
ALTER COLUMN "imageUrl" SET NOT NULL;
