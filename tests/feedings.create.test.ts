import { describe, it, expect } from 'vitest';
import { app } from '../src/app';
import { prisma } from '../src/db';
import { authedRequest, createTestUser } from './helpers/testAuth';

async function createSighting() {
  const res = await authedRequest(app).post('/sightings').send({ species: 'cat', lat: 0, lng: 0 });
  return res.body;
}

describe('POST /sightings/:sightingId/feedings', () => {
  it('creates a feeding log entry and returns it shaped for the client', async () => {
    const sighting = await createSighting();

    const res = await authedRequest(app)
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

    const res = await authedRequest(app).post(`/sightings/${sighting.id}/feedings`).send({});

    expect(res.status).toBe(201);
    expect(res.body.note).toBeNull();
  });

  it('returns 404 for an unknown sighting', async () => {
    const res = await authedRequest(app).post('/sightings/does-not-exist/feedings').send({});

    expect(res.status).toBe(404);
  });
});

describe('POST /sightings/:sightingId/feedings — shared', () => {
  it('lets another user add a feed, and marks the sighting fed for everyone', async () => {
    const sighting = await createSighting();

    const { user: feeder } = await createTestUser(); // second user is now "current"
    const res = await authedRequest(app)
      .post(`/sightings/${sighting.id}/feedings`)
      .send({ note: 'Kibble' });

    expect(res.status).toBe(201);
    expect(res.body).not.toHaveProperty('userId');

    // Recorded for abuse tracing, never returned.
    const row = await prisma.feedingLogEntry.findUnique({ where: { id: res.body.id } });
    expect(row?.userId).toBe(feeder.id);

    const seen = await authedRequest(app).get(`/sightings/${sighting.id}`);
    expect(seen.body.fed).toBe(true);
  });
});
