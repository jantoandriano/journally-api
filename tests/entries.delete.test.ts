import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../src/app';
import { prisma } from '../src/db';

describe('DELETE /entries/:id', () => {
  it('deletes the entry and its order items', async () => {
    const created = await request(app).post('/entries').send({
      placeName: 'Blue Bottle',
      neighborhood: 'Hayes Valley',
      city: 'San Francisco',
      orderItems: ['Latte'],
    });

    const res = await request(app).delete(`/entries/${created.body.id}`);
    expect(res.status).toBe(204);

    const found = await prisma.journalEntry.findUnique({ where: { id: created.body.id } });
    expect(found).toBeNull();

    const orphanOrderItems = await prisma.orderItem.findMany({
      where: { entryId: created.body.id },
    });
    expect(orphanOrderItems).toEqual([]);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).delete('/entries/does-not-exist');
    expect(res.status).toBe(404);
  });
});
