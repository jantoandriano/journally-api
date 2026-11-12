import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../db';
import { boundingBoxDeltas, haversineKm } from '../shared/geo';
import { startOfToday } from '../shared/time';
import { uploadsDir } from '../uploads';
import type {
  CreateSightingInput,
  MapSightingQuery,
  NearbySightingQuery,
  UpdateSightingInput,
} from './sightings.schema';
import { visibleSightingWhere } from './visibility';

/**
 * The relations every sighting read loads. A function, not a constant, so
 * "today" is evaluated per request: `fed`/`fedAt` are derived from the
 * latest feeding log entry since the start of the current day, by
 * timestamp — never by relying on the lazy purge in feedings.service
 * having already run.
 */
export function sightingInclude() {
  return {
    photos: true,
    attributes: true,
    feedingLogEntries: {
      where: { createdAt: { gte: startOfToday() } },
      orderBy: { createdAt: 'desc' as const },
      take: 1,
    },
  };
}

/**
 * Shapes a sighting for `viewerId`. Deliberately omits `userId`: pins are
 * anonymous, and `isMine` is the only ownership signal a client gets.
 */
export function shapeSighting(
  sighting: {
    id: string;
    userId: string;
    species: string;
    lat: number;
    lng: number;
    notes: string | null;
    placeName: string | null;
    createdAt: Date;
    updatedAt: Date;
    photos: { filePath: string }[];
    attributes: { name: string }[];
    feedingLogEntries: { createdAt: Date }[];
  },
  viewerId: string
) {
  const latestFeedToday = sighting.feedingLogEntries[0];
  return {
    id: sighting.id,
    species: sighting.species,
    lat: sighting.lat,
    lng: sighting.lng,
    notes: sighting.notes,
    placeName: sighting.placeName,
    isMine: sighting.userId === viewerId,
    fed: latestFeedToday !== undefined,
    fedAt: latestFeedToday?.createdAt ?? null,
    createdAt: sighting.createdAt,
    updatedAt: sighting.updatedAt,
    photoUrls: sighting.photos.map((photo) => `/uploads/${photo.filePath}`),
    attributes: sighting.attributes.map((attribute) => attribute.name),
  };
}

export async function createSighting(userId: string, input: CreateSightingInput) {
  const sighting = await prisma.sighting.create({
    data: {
      userId,
      species: input.species,
      lat: input.lat,
      lng: input.lng,
      placeName: input.placeName || null,
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      attributes: {
        create: input.attributes.map((name) => ({ name })),
      },
    },
    include: sightingInclude(),
  });

  return shapeSighting(sighting, userId);
}

export async function listSightings(userId: string) {
  const sightings = await prisma.sighting.findMany({
    where: { userId },
    include: sightingInclude(),
    orderBy: { createdAt: 'desc' },
  });
  return sightings.map((sighting) => shapeSighting(sighting, userId));
}

/** Any sighting visible to `userId`, not only their own. */
export async function getSightingById(userId: string, id: string) {
  const sighting = await prisma.sighting.findFirst({
    where: { AND: [{ id }, visibleSightingWhere(userId)] },
    include: sightingInclude(),
  });
  return sighting ? shapeSighting(sighting, userId) : null;
}

export async function updateSighting(userId: string, id: string, input: UpdateSightingInput) {
  const existing = await prisma.sighting.findFirst({ where: { id, userId } });
  if (!existing) return null;

  const sighting = await prisma.sighting.update({
    where: { id },
    data: {
      ...(input.species !== undefined ? { species: input.species } : {}),
      ...(input.lat !== undefined ? { lat: input.lat } : {}),
      ...(input.lng !== undefined ? { lng: input.lng } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.placeName !== undefined ? { placeName: input.placeName || null } : {}),
      ...(input.attributes !== undefined
        ? {
            attributes: {
              deleteMany: {},
              create: input.attributes.map((name) => ({ name })),
            },
          }
        : {}),
    },
    include: sightingInclude(),
  });

  return shapeSighting(sighting, userId);
}

export async function deleteSighting(userId: string, id: string) {
  const existing = await prisma.sighting.findFirst({
    where: { id, userId },
    include: { photos: true },
  });
  if (!existing) return false;

  await prisma.sighting.delete({ where: { id } });

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

export async function listNearbySightings(userId: string, query: NearbySightingQuery) {
  const { lat, lng, radiusKm, species } = query;
  const { latDelta, lngDelta } = boundingBoxDeltas(radiusKm, lat);

  const sightings = await prisma.sighting.findMany({
    where: {
      userId,
      lat: { gte: lat - latDelta, lte: lat + latDelta },
      lng: { gte: lng - lngDelta, lte: lng + lngDelta },
      ...(species !== undefined ? { species } : {}),
    },
    include: sightingInclude(),
  });

  return sightings
    .map((sighting) => ({
      ...shapeSighting(sighting, userId),
      distanceKm: haversineKm(lat, lng, sighting.lat, sighting.lng),
    }))
    .filter((sighting) => sighting.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

/** Most sightings one map request returns; the client treats a full page as incomplete. */
export const MAP_RESULT_LIMIT = 300;

/** Sightings from every user that the caller may see inside the box, newest first. */
export async function listSightingsInBounds(userId: string, query: MapSightingQuery) {
  const { south, west, north, east, species, fed } = query;

  const sightings = await prisma.sighting.findMany({
    where: {
      AND: [
        visibleSightingWhere(userId),
        { lat: { gte: south, lte: north }, lng: { gte: west, lte: east } },
        ...(species !== undefined ? [{ species }] : []),
        ...(fed === 'false'
          ? [{ feedingLogEntries: { none: { createdAt: { gte: startOfToday() } } } }]
          : []),
      ],
    },
    include: sightingInclude(),
    orderBy: { createdAt: 'desc' },
    take: MAP_RESULT_LIMIT,
  });

  return sightings.map((sighting) => shapeSighting(sighting, userId));
}
