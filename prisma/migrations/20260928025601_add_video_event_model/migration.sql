-- CreateTable
CREATE TABLE "VideoEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "orderValue" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VideoEvent_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "VideoEvent_videoId_eventType_idx" ON "VideoEvent"("videoId", "eventType");
