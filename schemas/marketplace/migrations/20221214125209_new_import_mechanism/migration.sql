/*
  Warnings:

  - The values [UNKNOWN] on the enum `CollectionsType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `config` on the `Collections` table. All the data in the column will be lost.
  - You are about to drop the column `fileType` on the `Tokens` table. All the data in the column will be lost.
  - You are about to drop the column `fileUrl` on the `Tokens` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "CollectionsType_new" AS ENUM ('MARKETPLACE', 'EXTERNAL');
ALTER TABLE "Collections" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "Collections" ALTER COLUMN "type" TYPE "CollectionsType_new" USING ("type"::text::"CollectionsType_new");
ALTER TYPE "CollectionsType" RENAME TO "CollectionsType_old";
ALTER TYPE "CollectionsType_new" RENAME TO "CollectionsType";
DROP TYPE "CollectionsType_old";
COMMIT;

-- DropIndex
DROP INDEX "Collections_config_idx";

-- AlterTable
ALTER TABLE "Collections" DROP COLUMN "config",
ALTER COLUMN "type" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Tokens" DROP COLUMN "fileType",
DROP COLUMN "fileUrl";
