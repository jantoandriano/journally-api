-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN "notes" TEXT;
ALTER TABLE "JournalEntry" ADD COLUMN "rating" REAL;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "note" TEXT;

-- CreateTable
CREATE TABLE "EntryAttribute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    CONSTRAINT "EntryAttribute_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
