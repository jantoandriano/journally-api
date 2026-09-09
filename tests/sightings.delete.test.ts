import { describe, it, expect } from 'vitest';
import { app } from '../src/app';
import { prisma } from '../src/db';
import { authedRequest } from './helpers/testAuth';

describe('DELETE /sightings/:id', () => {
  it('deletes the sighting', async () => {
    const created = await authedRequest(app).post('/sightings').send({
      species: 'cat',
      lat: 0,
      lng: 0,
    });

    const res = await authedRequest(app).delete(`/sightings/${created.body.id}`);
    expect(res.status).toBe(204);

    const found = await prisma.sighting.findUnique({ where: { id: created.body.id } });
    expect(found).toBeNull();
  });

  it('returns 404 for an unknown id', async () => {
    const res = await authedRequest(app).delete('/sightings/does-not-exist');
    expect(res.status).toBe(404);
  });
});
