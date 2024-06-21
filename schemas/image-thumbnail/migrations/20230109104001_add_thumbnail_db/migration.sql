-- CreateEnum
CREATE TYPE "AssetSize" AS ENUM ('STATIC_COVER_128', 'STATIC_COVER_256', 'STATIC_COVER_512', 'ANIMATED_INSIDE_512', 'ANIMATED_INSIDE_1024', 'ORIGINAL');

-- CreateEnum
CREATE TYPE "AssetEntityKind" AS ENUM ('TOKEN', 'USER_BANNER', 'USER_AVATAR');

-- CreateTable
CREATE TABLE "Thumbnail" (
    "key" TEXT NOT NULL,
    "size" "AssetSize" NOT NULL,
    "mimeType" TEXT NOT NULL,
    "entityKind" "AssetEntityKind" NOT NULL,
    "entity" JSONB NOT NULL,

    CONSTRAINT "Thumbnail_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Thumbnail_size_idx" ON "Thumbnail"("size");

-- CreateIndex
CREATE INDEX "Thumbnail_entityKind_idx" ON "Thumbnail"("entityKind");

-- CreateIndex
CREATE INDEX "Thumbnail_entity_idx" ON "Thumbnail" USING GIN ("entity" jsonb_path_ops);
