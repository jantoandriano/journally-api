import { prisma } from '../db';
import type { CreateEntryInput } from './entries.schema';

function shapeEntry(entry: {
  id: string;
  placeName: string;
  neighborhood: string;
  city: string;
  visitedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  orderItems: { name: string }[];
  photos: { filePath: string }[];
}) {
  return {
    id: entry.id,
    placeName: entry.placeName,
    neighborhood: entry.neighborhood,
    city: entry.city,
    visitedAt: entry.visitedAt,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    orderItems: entry.orderItems.map((item) => item.name),
    photoUrls: entry.photos.map((photo) => `/uploads/${photo.filePath}`),
  };
}

export async function createEntry(input: CreateEntryInput) {
  const entry = await prisma.journalEntry.create({
    data: {
      placeName: input.placeName,
      neighborhood: input.neighborhood,
      city: input.city,
      ...(input.visitedAt ? { visitedAt: input.visitedAt } : {}),
      orderItems: {
        create: input.orderItems.map((name) => ({ name })),
      },
    },
    include: { orderItems: true, photos: true },
  });

  return shapeEntry(entry);
}

export async function listEntries() {
  const entries = await prisma.journalEntry.findMany({
    include: { orderItems: true, photos: true },
    orderBy: { visitedAt: 'desc' },
  });
  return entries.map(shapeEntry);
}

export async function getEntryById(id: string) {
  const entry = await prisma.journalEntry.findUnique({
    where: { id },
    include: { orderItems: true, photos: true },
  });
  return entry ? shapeEntry(entry) : null;
}
