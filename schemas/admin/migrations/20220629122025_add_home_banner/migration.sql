-- CreateTable
CREATE TABLE "HomeBanner" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "image" TEXT NOT NULL,
    "position" SMALLINT NOT NULL,
    "collectionId" TEXT,
    "artist" TEXT,
    "url" TEXT,

    CONSTRAINT "HomeBanner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeBanner_position_idx" ON "HomeBanner"("position");
