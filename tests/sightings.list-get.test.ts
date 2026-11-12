import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../src/app';
import { prisma } from '../src/db';
import { authedRequest, createTestUser } from './helpers/testAuth';

async function createSighting(overrides: Record<string, unknown> = {}) {
  const res = await authedRequest(app)
    .post('/sightings')
    .send({ species: 'cat', lat: 0, lng: 0, ...overrides });
  return res.body;
}

describe('GET /sightings', () => {
  it('lists sightings newest first', async () => {
    const older = await createSighting({ notes: 'older' });
    const newer = await createSighting({ notes: 'newer' });

    const res = await authedRequest(app).get('/sightings');

    expect(res.status).toBe(200);
    expect(res.body.map((s: { id: string }) => s.id)).toEqual([newer.id, older.id]);
  });
});

describe('GET /sightings/:id', () => {
  it('returns a single sighting', async () => {
    const created = await createSighting();

    const res = await authedRequest(app).get(`/sightings/${created.id}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.id);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await authedRequest(app).get('/sightings/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Sighting not found' });
  });
});

describe('GET /sightings — auth', () => {
  it('rejects a request with no token', async () => {
    const res = await request(app).get('/sightings');
    expect(res.status).toBe(401);
  });
});

describe('GET /sightings/:id — shared', () => {
  it("returns another user's sighting with isMine false and no userId", async () => {
    const created = await authedRequest(app)
      .post('/sightings')
      .send({ species: 'cat', lat: 0, lng: 0 });

    await createTestUser(); // switches the module-level "current" token to a second user
    const res = await authedRequest(app).get(`/sightings/${created.body.id}`);

    expect(res.status).toBe(200);
    expect(res.body.isMine).toBe(false);
    expect(res.body).not.toHaveProperty('userId');
  });

  it("GET /sightings still lists only the caller's own", async () => {
    await authedRequest(app).post('/sightings').send({ species: 'cat', lat: 0, lng: 0 });

    await createTestUser();
    const res = await authedRequest(app).get('/sightings');

    expect(res.body).toEqual([]);
  });
});

describe('derived fed status', () => {
  it('is true with fedAt once a feeding entry exists today', async () => {
    const created = await authedRequest(app).post('/sightings').send({ species: 'cat', lat: 0, lng: 0 });
    await authedRequest(app).post(`/sightings/${created.body.id}/feedings`).send({});

    const res = await authedRequest(app).get(`/sightings/${created.body.id}`);

    expect(res.body.fed).toBe(true);
    expect(res.body.fedAt).toEqual(expect.any(String));
  });

  it('ignores a feeding entry from before today', async () => {
    const created = await authedRequest(app).post('/sightings').send({ species: 'cat', lat: 0, lng: 0 });
    await prisma.feedingLogEntry.create({
      data: { sightingId: created.body.id, createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    });

    const res = await authedRequest(app).get(`/sightings/${created.body.id}`);

    expect(res.body.fed).toBe(false);
    expect(res.body.fedAt).toBeNull();
  });
});
