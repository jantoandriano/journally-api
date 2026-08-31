import { describe, it, expect } from 'vitest';
import { prisma } from '../src/db';

describe('prisma client', () => {
  it('creates and fetches a journal entry', async () => {
    const entry = await prisma.journalEntry.create({
      data: {
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
