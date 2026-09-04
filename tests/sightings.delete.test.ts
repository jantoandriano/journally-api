import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../src/app';
import { prisma } from '../src/db';

describe('DELETE /sightings/:id', () => {
  it('deletes the sighting', async () => {
    const created = await request(app).post('/sightings').send({
      species: 'cat',
      lat: 0,
      lng: 0,
    });

    const res = await request(app).delete(`/sightings/${created.body.id}`);
    expect(res.status).toBe(204);

    const found = await prisma.sighting.findUnique({ where: { id: created.body.id } });
    expect(found).toBeNull();
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).delete('/sightings/does-not-exist');
    expect(res.status).toBe(404);
  });
});
