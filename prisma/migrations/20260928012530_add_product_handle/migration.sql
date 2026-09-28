/*
  Warnings:

  - Added the required column `productHandle` to the `VideoProduct` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_VideoProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "videoId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "productHandle" TEXT NOT NULL,
    CONSTRAINT "VideoProduct_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_VideoProduct" ("id", "productId", "productTitle", "videoId") SELECT "id", "productId", "productTitle", "videoId" FROM "VideoProduct";
DROP TABLE "VideoProduct";
ALTER TABLE "new_VideoProduct" RENAME TO "VideoProduct";
CREATE UNIQUE INDEX "VideoProduct_videoId_productId_key" ON "VideoProduct"("videoId", "productId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
