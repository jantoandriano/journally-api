-- CreateTable
CREATE TABLE "SightingAttribute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sightingId" TEXT NOT NULL,
    CONSTRAINT "SightingAttribute_sightingId_fkey" FOREIGN KEY ("sightingId") REFERENCES "Sighting" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
