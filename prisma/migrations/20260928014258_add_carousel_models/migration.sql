-- CreateTable
CREATE TABLE "Carousel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CarouselVideo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "carouselId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "CarouselVideo_carouselId_fkey" FOREIGN KEY ("carouselId") REFERENCES "Carousel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CarouselVideo_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Carousel_shop_name_key" ON "Carousel"("shop", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CarouselVideo_carouselId_videoId_key" ON "CarouselVideo"("carouselId", "videoId");
