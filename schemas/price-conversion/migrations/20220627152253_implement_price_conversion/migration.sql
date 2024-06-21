-- CreateTable
CREATE TABLE "ConversionRate" (
    "currency" TEXT NOT NULL,
    "priceUSD" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversionRate_pkey" PRIMARY KEY ("currency","updatedAt")
);
