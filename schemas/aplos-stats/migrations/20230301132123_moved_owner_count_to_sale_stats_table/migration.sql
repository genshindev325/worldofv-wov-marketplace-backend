/*
  Warnings:

  - You are about to drop the column `ownerCount` on the `Collections` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Collections" DROP COLUMN "ownerCount";

-- AlterTable
ALTER TABLE "SaleStats" ADD COLUMN     "ownerCount" INTEGER NOT NULL DEFAULT 0;
