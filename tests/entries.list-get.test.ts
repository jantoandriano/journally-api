import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../src/app';
import { authedRequest, createTestUser } from './helpers/testAuth';

async function createEntry(overrides: Record<string, unknown> = {}) {
  const res = await authedRequest(app)
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

    const res = await authedRequest(app).get('/entries');

    expect(res.status).toBe(200);
    expect(res.body.map((e: { id: string }) => e.id)).toEqual([newer.id, older.id]);
  });
});

describe('GET /entries/:id', () => {
  it('returns a single entry', async () => {
    const created = await createEntry();

    const res = await authedRequest(app).get(`/entries/${created.id}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.id);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await authedRequest(app).get('/entries/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Entry not found' });
  });
});

describe('GET /entries — auth', () => {
  it('rejects a request with no token', async () => {
    const res = await request(app).get('/entries');
    expect(res.status).toBe(401);
  });
});

describe('GET /entries/:id — ownership', () => {
  it("returns 404 for another user's entry", async () => {
    // The global beforeEach (tests/setup.ts) already created a user and
    // pointed authedRequest at their token — they're the owner here.
    const created = await authedRequest(app).post('/entries').send({
      placeName: 'Owner Only Cafe',
      neighborhood: 'Hayes Valley',
      city: 'San Francisco',
      orderItems: [],
    });

    await createTestUser(); // switches the module-level "current" token to a second user
    const res = await authedRequest(app).get(`/entries/${created.body.id}`);

    expect(res.status).toBe(404);
  });
});
