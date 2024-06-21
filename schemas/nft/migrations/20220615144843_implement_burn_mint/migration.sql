-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "burnContractAddress" CITEXT,
ADD COLUMN     "cooldownContractAddress" CITEXT;

-- AlterTable
ALTER TABLE "Edition" ADD COLUMN     "cooldownEnd" INTEGER;
