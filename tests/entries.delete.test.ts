import { describe, it, expect } from 'vitest';
import { app } from '../src/app';
import { prisma } from '../src/db';
import { authedRequest, createTestUser } from './helpers/testAuth';

describe('DELETE /entries/:id', () => {
  it('deletes the entry and its order items', async () => {
    const created = await authedRequest(app).post('/entries').send({
      placeName: 'Blue Bottle',
      neighborhood: 'Hayes Valley',
      city: 'San Francisco',
      orderItems: [{ name: 'Latte', price: 4.5 }],
    });

    const res = await authedRequest(app).delete(`/entries/${created.body.id}`);
    expect(res.status).toBe(204);

    const found = await prisma.journalEntry.findUnique({ where: { id: created.body.id } });
    expect(found).toBeNull();

    const orphanOrderItems = await prisma.orderItem.findMany({
      where: { entryId: created.body.id },
    });
    expect(orphanOrderItems).toEqual([]);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await authedRequest(app).delete('/entries/does-not-exist');
    expect(res.status).toBe(404);
  });
});

describe('DELETE /entries/:id — ownership', () => {
  it("returns 404 for another user's entry", async () => {
    const created = await authedRequest(app).post('/entries').send({
      placeName: 'Owner Only Cafe',
      neighborhood: 'Hayes Valley',
      city: 'San Francisco',
      orderItems: [],
    });

    await createTestUser(); // switches the module-level "current" token to a second user
    const res = await authedRequest(app).delete(`/entries/${created.body.id}`);

    expect(res.status).toBe(404);

    const found = await prisma.journalEntry.findUnique({ where: { id: created.body.id } });
    expect(found).not.toBeNull();
  });
});
