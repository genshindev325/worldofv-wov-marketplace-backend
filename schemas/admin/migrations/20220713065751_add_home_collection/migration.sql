-- CreateTable
CREATE TABLE "HomeCollection" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "position" SMALLINT NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "bannerImageUrl" TEXT NOT NULL,
    "bannerLinkUrl" TEXT NOT NULL,
    "avatarImageUrl" TEXT,
    "avatarLinkUrl" TEXT,
    "avatarName" TEXT,
    "avatarVerifiedLevel" TEXT,

    CONSTRAINT "HomeCollection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeCollection_position_idx" ON "HomeCollection"("position");
