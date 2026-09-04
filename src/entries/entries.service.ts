import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../db';
import { boundingBoxDeltas, haversineKm } from '../shared/geo';
import { uploadsDir } from '../uploads';
import type { CreateEntryInput, NearbyEntryQuery, UpdateEntryInput } from './entries.schema';

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
  notes: string | null;
  rating: number | null;
  orderItems: { name: string; price: number | null; note: string | null }[];
  photos: { filePath: string }[];
  attributes: { name: string }[];
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
    notes: entry.notes,
    rating: entry.rating,
    orderItems: entry.orderItems.map((item) => ({
      name: item.name,
      price: item.price,
      note: item.note,
    })),
    photoUrls: entry.photos.map((photo) => `/uploads/${photo.filePath}`),
    photoCount: entry.photos.length,
    attributes: entry.attributes.map((attribute) => attribute.name),
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
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.rating !== undefined ? { rating: input.rating } : {}),
      orderItems: {
        create: input.orderItems.map((item) => ({
          name: item.name,
          price: item.price,
          note: item.note,
        })),
      },
      attributes: {
        create: input.attributes.map((name) => ({ name })),
      },
    },
    include: { orderItems: true, photos: true, attributes: true },
  });

  return shapeEntry(entry);
}

export async function listEntries() {
  const entries = await prisma.journalEntry.findMany({
    include: { orderItems: true, photos: true, attributes: true },
    orderBy: { visitedAt: 'desc' },
  });
  return entries.map(shapeEntry);
}

export async function getEntryById(id: string) {
  const entry = await prisma.journalEntry.findUnique({
    where: { id },
    include: { orderItems: true, photos: true, attributes: true },
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
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.rating !== undefined ? { rating: input.rating } : {}),
      ...(input.orderItems !== undefined
        ? {
            orderItems: {
              deleteMany: {},
              create: input.orderItems.map((item) => ({
                name: item.name,
                price: item.price,
                note: item.note,
              })),
            },
          }
        : {}),
      ...(input.attributes !== undefined
        ? {
            attributes: {
              deleteMany: {},
              create: input.attributes.map((name) => ({ name })),
            },
          }
        : {}),
    },
    include: { orderItems: true, photos: true, attributes: true },
  });

  return shapeEntry(entry);
}

export async function listNearbyEntries(query: NearbyEntryQuery) {
  const { lat, lng, radiusKm } = query;
  const { latDelta, lngDelta } = boundingBoxDeltas(radiusKm, lat);

  const entries = await prisma.journalEntry.findMany({
    where: {
      // `lat`/`lng` are nullable on JournalEntry — entries without them are
      // naturally excluded here since a range comparison against NULL is
      // never true, so no explicit not-null clause is needed.
      lat: { gte: lat - latDelta, lte: lat + latDelta },
      lng: { gte: lng - lngDelta, lte: lng + lngDelta },
    },
    include: { orderItems: true, photos: true, attributes: true },
  });

  return entries
    .map((entry) => ({
      ...shapeEntry(entry),
      distanceKm: haversineKm(lat, lng, entry.lat as number, entry.lng as number),
    }))
    .filter((entry) => entry.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
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
