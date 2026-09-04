import path from 'node:path';
import fs from 'node:fs/promises';
import { beforeEach, afterEach } from 'vitest';
import { prisma } from '../src/db';
import { uploadsDir } from '../src/uploads';

beforeEach(async () => {
  await prisma.photo.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.entryAttribute.deleteMany();
  await prisma.sightingPhoto.deleteMany();
  await prisma.sighting.deleteMany();
  await prisma.journalEntry.deleteMany();
});

afterEach(async () => {
  const files = await fs.readdir(uploadsDir).catch(() => [] as string[]);
  await Promise.all(files.map((file) => fs.unlink(path.join(uploadsDir, file))));
});
