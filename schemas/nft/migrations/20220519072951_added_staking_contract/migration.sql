-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "stakingContractAddresses" CITEXT[];

-- AlterTable
ALTER TABLE "Edition" ADD COLUMN     "stakingContractAddress" CITEXT;
