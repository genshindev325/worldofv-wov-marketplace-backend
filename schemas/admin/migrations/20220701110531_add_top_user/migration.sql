-- CreateTable
CREATE TABLE "TopArtist" (
    "address" CITEXT NOT NULL,
    "position" SMALLINT NOT NULL,

    CONSTRAINT "TopArtist_pkey" PRIMARY KEY ("address")
);

-- CreateTable
CREATE TABLE "TopCollector" (
    "address" CITEXT NOT NULL,
    "position" SMALLINT NOT NULL,

    CONSTRAINT "TopCollector_pkey" PRIMARY KEY ("address")
);
