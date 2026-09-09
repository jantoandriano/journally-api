import { describe, it, expect } from 'vitest';
import { prisma } from '../src/db';

describe('prisma client', () => {
  it('creates and fetches a journal entry', async () => {
    const user = await prisma.user.create({
      data: { email: 'db-test@example.com', passwordHash: 'irrelevant-for-this-test' },
    });

    const entry = await prisma.journalEntry.create({
      data: {
        userId: user.id,
        placeName: 'Blue Bottle',
        neighborhood: 'Hayes Valley',
        city: 'San Francisco',
      },
    });

    const found = await prisma.journalEntry.findUniqueOrThrow({
      where: { id: entry.id },
    });

    expect(found.placeName).toBe('Blue Bottle');
  });
});
