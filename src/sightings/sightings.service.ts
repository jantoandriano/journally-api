import { prisma } from '../db';
import type { CreateSightingInput } from './sightings.schema';

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
