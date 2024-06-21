/*
  Warnings:

  - Made the column `media` on table `Tokens` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Tokens" ALTER COLUMN "media" SET NOT NULL;
