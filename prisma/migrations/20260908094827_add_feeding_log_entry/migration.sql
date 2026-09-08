-- CreateTable
CREATE TABLE "FeedingLogEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "note" TEXT,
    "sightingId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeedingLogEntry_sightingId_fkey" FOREIGN KEY ("sightingId") REFERENCES "Sighting" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
