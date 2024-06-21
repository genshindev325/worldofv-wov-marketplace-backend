-- CreateTable
CREATE TABLE "MinimumOffer" (
    "smartContractAddress" CITEXT NOT NULL,
    "userAddress" CITEXT NOT NULL,
    "price" DECIMAL(78,0),

    CONSTRAINT "MinimumOffer_pkey" PRIMARY KEY ("smartContractAddress","userAddress")
);
