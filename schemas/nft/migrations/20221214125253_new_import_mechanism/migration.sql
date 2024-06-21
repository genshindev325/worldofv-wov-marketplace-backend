/*
  Warnings:

  - The values [UNKNOWN] on the enum `CollectionType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `config` on the `Collection` table. All the data in the column will be lost.
  - You are about to drop the column `importType` on the `Collection` table. All the data in the column will be lost.
  - You are about to drop the column `fileType` on the `Token` table. All the data in the column will be lost.
  - You are about to drop the column `fileUrl` on the `Token` table. All the data in the column will be lost.
  - You are about to drop the column `metadataUrl` on the `Token` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "CollectionType_new" AS ENUM ('MARKETPLACE', 'EXTERNAL');
ALTER TABLE "Collection" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "Collection" ALTER COLUMN "type" TYPE "CollectionType_new" USING ("type"::text::"CollectionType_new");
ALTER TYPE "CollectionType" RENAME TO "CollectionType_old";
ALTER TYPE "CollectionType_new" RENAME TO "CollectionType";
DROP TYPE "CollectionType_old";
COMMIT;

-- DropIndex
DROP INDEX "Collection_config_idx";

-- AlterTable
ALTER TABLE "Collection" DROP COLUMN "config",
DROP COLUMN "importType",
ADD COLUMN     "fetcherConfig" JSONB,
ALTER COLUMN "type" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Token" DROP COLUMN "fileType",
DROP COLUMN "fileUrl",
DROP COLUMN "metadataUrl";

-- DropEnum
DROP TYPE "ImportType";
