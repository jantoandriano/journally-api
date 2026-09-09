import { prisma } from '../db';
import type { CreateFeedingLogEntryInput } from './feedings.schema';

function shapeFeedingLogEntry(entry: {
  id: string;
  note: string | null;
  sightingId: string;
  createdAt: Date;
}) {
  return {
    id: entry.id,
    note: entry.note,
    sightingId: entry.sightingId,
    createdAt: entry.createdAt,
  };
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

async function purgeStaleEntries(sightingId: string) {
  await prisma.feedingLogEntry.deleteMany({
    where: { sightingId, createdAt: { lt: startOfToday() } },
  });
}

export async function createFeedingLogEntry(
  userId: string,
  sightingId: string,
  input: CreateFeedingLogEntryInput
) {
  const sighting = await prisma.sighting.findFirst({ where: { id: sightingId, userId } });
  if (!sighting) return null;

  await purgeStaleEntries(sightingId);

  const entry = await prisma.feedingLogEntry.create({
    data: {
      sightingId,
      ...(input.note !== undefined ? { note: input.note } : {}),
    },
  });

  return shapeFeedingLogEntry(entry);
}

export async function listFeedingLog(userId: string, sightingId: string) {
  const sighting = await prisma.sighting.findFirst({ where: { id: sightingId, userId } });
  if (!sighting) return null;

  await purgeStaleEntries(sightingId);

  const entries = await prisma.feedingLogEntry.findMany({
    where: { sightingId },
    orderBy: { createdAt: 'desc' },
  });

  return entries.map(shapeFeedingLogEntry);
}
