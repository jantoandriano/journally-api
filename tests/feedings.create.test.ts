import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../src/app';

async function createSighting() {
  const res = await request(app).post('/sightings').send({ species: 'cat', lat: 0, lng: 0 });
  return res.body;
}

describe('POST /sightings/:sightingId/feedings', () => {
  it('creates a feeding log entry and returns it shaped for the client', async () => {
    const sighting = await createSighting();

    const res = await request(app)
      .post(`/sightings/${sighting.id}/feedings`)
      .send({ note: 'Wet food' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      sightingId: sighting.id,
      note: 'Wet food',
    });
    expect(res.body.id).toEqual(expect.any(String));
    expect(res.body.createdAt).toEqual(expect.any(String));
  });

  it('creates a feeding log entry without a note', async () => {
    const sighting = await createSighting();

    const res = await request(app).post(`/sightings/${sighting.id}/feedings`).send({});

    expect(res.status).toBe(201);
    expect(res.body.note).toBeNull();
  });

  it('returns 404 for an unknown sighting', async () => {
    const res = await request(app).post('/sightings/does-not-exist/feedings').send({});

    expect(res.status).toBe(404);
  });
});
