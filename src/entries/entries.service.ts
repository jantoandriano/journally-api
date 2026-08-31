import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../db';
import { uploadsDir } from '../uploads';
import type { CreateEntryInput, UpdateEntryInput } from './entries.schema';

function shapeEntry(entry: {
  id: string;
  placeName: string;
  neighborhood: string;
  city: string;
  visitedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  lat: number | null;
  lng: number | null;
  placeId: string | null;
  orderItems: { name: string; price: number | null }[];
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
    lat: entry.lat,
    lng: entry.lng,
    placeId: entry.placeId,
    orderItems: entry.orderItems.map((item) => ({ name: item.name, price: item.price })),
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
      ...(input.lat !== undefined ? { lat: input.lat } : {}),
      ...(input.lng !== undefined ? { lng: input.lng } : {}),
      ...(input.placeId !== undefined ? { placeId: input.placeId } : {}),
      orderItems: {
        create: input.orderItems.map((item) => ({ name: item.name, price: item.price })),
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

export async function updateEntry(id: string, input: UpdateEntryInput) {
  const existing = await prisma.journalEntry.findUnique({ where: { id } });
  if (!existing) return null;

  const entry = await prisma.journalEntry.update({
    where: { id },
    data: {
      ...(input.placeName !== undefined ? { placeName: input.placeName } : {}),
      ...(input.neighborhood !== undefined ? { neighborhood: input.neighborhood } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.visitedAt !== undefined ? { visitedAt: input.visitedAt } : {}),
      ...(input.lat !== undefined ? { lat: input.lat } : {}),
      ...(input.lng !== undefined ? { lng: input.lng } : {}),
      ...(input.placeId !== undefined ? { placeId: input.placeId } : {}),
      ...(input.orderItems !== undefined
        ? {
            orderItems: {
              deleteMany: {},
              create: input.orderItems.map((item) => ({ name: item.name, price: item.price })),
            },
          }
        : {}),
    },
    include: { orderItems: true, photos: true },
  });

  return shapeEntry(entry);
}

export async function deleteEntry(id: string) {
  const existing = await prisma.journalEntry.findUnique({
    where: { id },
    include: { photos: true },
  });
  if (!existing) return false;

  await prisma.journalEntry.delete({ where: { id } });

  await Promise.all(
    existing.photos.map(async (photo) => {
      try {
        await fs.unlink(path.join(uploadsDir, photo.filePath));
      } catch (err) {
        console.warn(`Failed to remove photo file ${photo.filePath}`, err);
      }
    })
  );

  return true;
}
