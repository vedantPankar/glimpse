-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Carousel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "style" TEXT NOT NULL DEFAULT 'row',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Carousel" ("createdAt", "id", "name", "shop") SELECT "createdAt", "id", "name", "shop" FROM "Carousel";
DROP TABLE "Carousel";
ALTER TABLE "new_Carousel" RENAME TO "Carousel";
CREATE UNIQUE INDEX "Carousel_shop_name_key" ON "Carousel"("shop", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
