import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../src/app';

async function createEntry(overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/entries')
    .send({
      placeName: 'Blue Bottle',
      neighborhood: 'Hayes Valley',
      city: 'San Francisco',
      orderItems: [],
      ...overrides,
    });
  return res.body;
}

describe('GET /entries', () => {
  it('lists entries newest visitedAt first', async () => {
    const older = await createEntry({
      placeName: 'Older Cafe',
      visitedAt: '2026-01-01T00:00:00.000Z',
    });
    const newer = await createEntry({
      placeName: 'Newer Cafe',
      visitedAt: '2026-06-01T00:00:00.000Z',
    });

    const res = await request(app).get('/entries');

    expect(res.status).toBe(200);
    expect(res.body.map((e: { id: string }) => e.id)).toEqual([newer.id, older.id]);
  });
});

describe('GET /entries/:id', () => {
  it('returns a single entry', async () => {
    const created = await createEntry();

    const res = await request(app).get(`/entries/${created.id}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.id);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).get('/entries/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Entry not found' });
  });
});
