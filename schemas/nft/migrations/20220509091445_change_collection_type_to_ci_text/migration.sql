-- EnableExtension
CREATE EXTENSION IF NOT EXISTS citext SCHEMA pg_catalog;

-- AlterTable
ALTER TABLE "Collection" ALTER COLUMN "smartContractAddress" SET DATA TYPE CITEXT;
