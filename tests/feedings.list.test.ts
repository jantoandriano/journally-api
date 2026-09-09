import { describe, it, expect } from 'vitest';
import { app } from '../src/app';
import { prisma } from '../src/db';
import { authedRequest, createTestUser } from './helpers/testAuth';

async function createSighting() {
  const res = await authedRequest(app).post('/sightings').send({ species: 'cat', lat: 0, lng: 0 });
  return res.body;
}

describe('GET /sightings/:sightingId/feedings', () => {
  it('lists feeding log entries newest first', async () => {
    const sighting = await createSighting();
    await authedRequest(app)
      .post(`/sightings/${sighting.id}/feedings`)
      .send({ note: 'Dry kibble' });
    await authedRequest(app).post(`/sightings/${sighting.id}/feedings`).send({ note: 'Wet food' });

    const res = await authedRequest(app).get(`/sightings/${sighting.id}/feedings`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].note).toBe('Wet food');
    expect(res.body[1].note).toBe('Dry kibble');
  });

  it('returns 404 for an unknown sighting', async () => {
    const res = await authedRequest(app).get('/sightings/does-not-exist/feedings');

    expect(res.status).toBe(404);
  });

  it('purges entries from a previous day before returning the list', async () => {
    const sighting = await createSighting();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    await prisma.feedingLogEntry.create({
      data: { sightingId: sighting.id, note: 'Yesterday', createdAt: yesterday },
    });
    await authedRequest(app).post(`/sightings/${sighting.id}/feedings`).send({ note: 'Today' });

    const res = await authedRequest(app).get(`/sightings/${sighting.id}/feedings`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].note).toBe('Today');
  });
});

describe('GET /sightings/:sightingId/feedings — ownership', () => {
  it("returns 404 for another user's sighting", async () => {
    const sighting = await createSighting();
    await createTestUser();

    const res = await authedRequest(app).get(`/sightings/${sighting.id}/feedings`);

    expect(res.status).toBe(404);
  });
});
