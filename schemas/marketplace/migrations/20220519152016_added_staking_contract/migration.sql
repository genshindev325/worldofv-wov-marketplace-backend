-- AlterTable
ALTER TABLE "Collections" ADD COLUMN     "stakingContractAddresses" CITEXT[];

-- AlterTable
ALTER TABLE "Editions" ADD COLUMN     "stakingContractAddress" CITEXT;
