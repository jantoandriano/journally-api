import { beforeEach } from 'vitest';
import { prisma } from '../src/db';

beforeEach(async () => {
  await prisma.photo.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.journalEntry.deleteMany();
});
