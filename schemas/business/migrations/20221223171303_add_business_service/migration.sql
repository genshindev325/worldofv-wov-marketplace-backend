-- EnableExtension
CREATE EXTENSION IF NOT EXISTS citext SCHEMA pg_catalog;

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "disposableCodes" BOOLEAN NOT NULL,
    "uniqueClaimer" BOOLEAN NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecretCode" (
    "clientId" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "SecretCode_pkey" PRIMARY KEY ("clientId","value")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" SERIAL NOT NULL,
    "clientId" TEXT NOT NULL,
    "secretCodeValue" TEXT NOT NULL,
    "claimerAddress" CITEXT NOT NULL,
    "metadata" JSONB,
    "claimedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SecretCode" ADD CONSTRAINT "SecretCode_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_clientId_secretCodeValue_fkey" FOREIGN KEY ("clientId", "secretCodeValue") REFERENCES "SecretCode"("clientId", "value") ON DELETE CASCADE ON UPDATE CASCADE;
