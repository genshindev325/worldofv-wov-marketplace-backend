/*
  Warnings:

  - You are about to drop the column `createdAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `ipfsFileHash` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `ipfsMetadataHash` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "User_createdAt_idx";

-- DropIndex
DROP INDEX "User_updatedAt_idx";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "createdAt",
DROP COLUMN "ipfsFileHash",
DROP COLUMN "ipfsMetadataHash",
DROP COLUMN "updatedAt";
