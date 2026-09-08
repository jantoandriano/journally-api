import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../src/app';
import { prisma } from '../src/db';

async function createSighting() {
  const res = await request(app).post('/sightings').send({ species: 'cat', lat: 0, lng: 0 });
  return res.body;
}

describe('GET /sightings/:sightingId/feedings', () => {
  it('lists feeding log entries newest first', async () => {
    const sighting = await createSighting();
    await request(app).post(`/sightings/${sighting.id}/feedings`).send({ note: 'Dry kibble' });
    await request(app).post(`/sightings/${sighting.id}/feedings`).send({ note: 'Wet food' });

    const res = await request(app).get(`/sightings/${sighting.id}/feedings`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].note).toBe('Wet food');
    expect(res.body[1].note).toBe('Dry kibble');
  });

  it('returns 404 for an unknown sighting', async () => {
    const res = await request(app).get('/sightings/does-not-exist/feedings');

    expect(res.status).toBe(404);
  });

  it('purges entries from a previous day before returning the list', async () => {
    const sighting = await createSighting();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    await prisma.feedingLogEntry.create({
      data: { sightingId: sighting.id, note: 'Yesterday', createdAt: yesterday },
    });
    await request(app).post(`/sightings/${sighting.id}/feedings`).send({ note: 'Today' });

    const res = await request(app).get(`/sightings/${sighting.id}/feedings`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].note).toBe('Today');
  });
});
