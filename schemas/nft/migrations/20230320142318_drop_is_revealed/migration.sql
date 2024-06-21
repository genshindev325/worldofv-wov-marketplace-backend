/*
  Warnings:

  - You are about to drop the column `isRevealed` on the `Collection` table. All the data in the column will be lost.
  - You are about to drop the column `placeholderImageUrl` on the `Collection` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Collection_isRevealed_idx";

-- AlterTable
ALTER TABLE "Collection" DROP COLUMN "isRevealed",
DROP COLUMN "placeholderImageUrl";
