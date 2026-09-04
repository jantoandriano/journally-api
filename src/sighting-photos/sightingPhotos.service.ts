import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../db';
import { uploadsDir } from '../uploads';

export { upload } from '../photos/photos.service';

export async function addSightingPhoto(sightingId: string, filePath: string) {
  const sighting = await prisma.sighting.findUnique({ where: { id: sightingId } });
  if (!sighting) return null;

  const photo = await prisma.sightingPhoto.create({
    data: { sightingId, filePath },
  });

  return { id: photo.id, url: `/uploads/${photo.filePath}` };
}

export async function deleteSightingPhoto(sightingId: string, photoId: string) {
  const photo = await prisma.sightingPhoto.findFirst({
    where: { id: photoId, sightingId },
  });
  if (!photo) return false;

  await prisma.sightingPhoto.delete({ where: { id: photo.id } });

  try {
    await unlink(path.join(uploadsDir, photo.filePath));
  } catch (err) {
    console.warn(`Failed to remove photo file ${photo.filePath}`, err);
  }

  return true;
}
