import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../src/app';

async function createSighting(overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/sightings')
    .send({ species: 'cat', lat: 0, lng: 0, ...overrides });
  return res.body;
}

describe('GET /sightings', () => {
  it('lists sightings newest first', async () => {
    const older = await createSighting({ notes: 'older' });
    const newer = await createSighting({ notes: 'newer' });

    const res = await request(app).get('/sightings');

    expect(res.status).toBe(200);
    expect(res.body.map((s: { id: string }) => s.id)).toEqual([newer.id, older.id]);
  });
});

describe('GET /sightings/:id', () => {
  it('returns a single sighting', async () => {
    const created = await createSighting();

    const res = await request(app).get(`/sightings/${created.id}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.id);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).get('/sightings/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Sighting not found' });
  });
});
