/*
  Warnings:

  - You are about to drop the column `ipfsFileHash` on the `Users` table. All the data in the column will be lost.
  - You are about to drop the column `profileImageUrl` on the `Users` table. All the data in the column will be lost.
  - Made the column `assets` on table `Users` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Users" DROP COLUMN "ipfsFileHash",
DROP COLUMN "profileImageUrl",
ALTER COLUMN "assets" SET NOT NULL;
