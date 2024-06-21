/*
  Warnings:

  - You are about to drop the column `isRevealed` on the `Collections` table. All the data in the column will be lost.
  - You are about to drop the column `placeholderImageUrl` on the `Collections` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Collections_isRevealed_idx";

-- AlterTable
ALTER TABLE "Collections" DROP COLUMN "isRevealed",
DROP COLUMN "placeholderImageUrl";
