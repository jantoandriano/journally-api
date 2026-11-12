-- AlterTable
ALTER TABLE "Sighting" ADD COLUMN "hiddenAt" DATETIME;
ALTER TABLE "Sighting" ADD COLUMN "placeName" TEXT;

-- CreateTable
CREATE TABLE "SightingReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sightingId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SightingReport_sightingId_fkey" FOREIGN KEY ("sightingId") REFERENCES "Sighting" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SightingReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FeedingLogEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "note" TEXT,
    "sightingId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeedingLogEntry_sightingId_fkey" FOREIGN KEY ("sightingId") REFERENCES "Sighting" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FeedingLogEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_FeedingLogEntry" ("createdAt", "id", "note", "sightingId") SELECT "createdAt", "id", "note", "sightingId" FROM "FeedingLogEntry";
DROP TABLE "FeedingLogEntry";
ALTER TABLE "new_FeedingLogEntry" RENAME TO "FeedingLogEntry";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "SightingReport_sightingId_reporterId_key" ON "SightingReport"("sightingId", "reporterId");

-- CreateIndex
CREATE INDEX "Sighting_lat_lng_idx" ON "Sighting"("lat", "lng");
