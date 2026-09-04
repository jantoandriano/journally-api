import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../db';
import { boundingBoxDeltas, haversineKm } from '../shared/geo';
import { uploadsDir } from '../uploads';
import type {
  CreateSightingInput,
  NearbySightingQuery,
  UpdateSightingInput,
} from './sightings.schema';

function shapeSighting(sighting: {
  id: string;
  species: string;
  lat: number;
  lng: number;
  notes: string | null;
  fed: boolean;
  fedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  photos: { filePath: string }[];
}) {
  return {
    id: sighting.id,
    species: sighting.species,
    lat: sighting.lat,
    lng: sighting.lng,
    notes: sighting.notes,
    fed: sighting.fed,
    fedAt: sighting.fedAt,
    createdAt: sighting.createdAt,
    updatedAt: sighting.updatedAt,
    photoUrls: sighting.photos.map((photo) => `/uploads/${photo.filePath}`),
  };
}

export async function createSighting(input: CreateSightingInput) {
  const sighting = await prisma.sighting.create({
    data: {
      species: input.species,
      lat: input.lat,
      lng: input.lng,
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    },
    include: { photos: true },
  });

  return shapeSighting(sighting);
}

export async function listSightings() {
  const sightings = await prisma.sighting.findMany({
    include: { photos: true },
    orderBy: { createdAt: 'desc' },
  });
  return sightings.map(shapeSighting);
}

export async function getSightingById(id: string) {
  const sighting = await prisma.sighting.findUnique({
    where: { id },
    include: { photos: true },
  });
  return sighting ? shapeSighting(sighting) : null;
}

export async function updateSighting(id: string, input: UpdateSightingInput) {
  const existing = await prisma.sighting.findUnique({ where: { id } });
  if (!existing) return null;

  const sighting = await prisma.sighting.update({
    where: { id },
    data: {
      ...(input.species !== undefined ? { species: input.species } : {}),
      ...(input.lat !== undefined ? { lat: input.lat } : {}),
      ...(input.lng !== undefined ? { lng: input.lng } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.fed !== undefined
        ? { fed: input.fed, fedAt: input.fed ? new Date() : null }
        : {}),
    },
    include: { photos: true },
  });

  return shapeSighting(sighting);
}

export async function deleteSighting(id: string) {
  const existing = await prisma.sighting.findUnique({
    where: { id },
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

export async function listNearbySightings(query: NearbySightingQuery) {
  const { lat, lng, radiusKm, species } = query;
  const { latDelta, lngDelta } = boundingBoxDeltas(radiusKm, lat);

  const sightings = await prisma.sighting.findMany({
    where: {
      lat: { gte: lat - latDelta, lte: lat + latDelta },
      lng: { gte: lng - lngDelta, lte: lng + lngDelta },
      ...(species !== undefined ? { species } : {}),
    },
    include: { photos: true },
  });

  return sightings
    .map((sighting) => ({
      ...shapeSighting(sighting),
      distanceKm: haversineKm(lat, lng, sighting.lat, sighting.lng),
    }))
    .filter((sighting) => sighting.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
