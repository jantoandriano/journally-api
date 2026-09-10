import { describe, it, expect } from 'vitest';
import { app } from '../src/app';
import { authedRequest, createTestUser } from './helpers/testAuth';

describe('PATCH /sightings/:id', () => {
  it('updates only the fields provided', async () => {
    const created = await authedRequest(app).post('/sightings').send({
      species: 'cat',
      lat: 0,
      lng: 0,
      notes: 'original notes',
    });

    const res = await authedRequest(app)
      .patch(`/sightings/${created.body.id}`)
      .send({ notes: 'updated notes' });

    expect(res.status).toBe(200);
    expect(res.body.notes).toBe('updated notes');
    expect(res.body.species).toBe('cat');
  });

  it('sets fedAt when fed is toggled to true', async () => {
    const created = await authedRequest(app).post('/sightings').send({
      species: 'dog',
      lat: 0,
      lng: 0,
    });
    expect(created.body.fed).toBe(false);
    expect(created.body.fedAt).toBeNull();

    const res = await authedRequest(app).patch(`/sightings/${created.body.id}`).send({ fed: true });

    expect(res.status).toBe(200);
    expect(res.body.fed).toBe(true);
    expect(res.body.fedAt).toEqual(expect.any(String));
  });

  it('clears fedAt when fed is toggled back to false', async () => {
    const created = await authedRequest(app).post('/sightings').send({
      species: 'dog',
      lat: 0,
      lng: 0,
    });
    await authedRequest(app).patch(`/sightings/${created.body.id}`).send({ fed: true });

    const res = await authedRequest(app).patch(`/sightings/${created.body.id}`).send({ fed: false });

    expect(res.status).toBe(200);
    expect(res.body.fed).toBe(false);
    expect(res.body.fedAt).toBeNull();
  });

  it('returns 404 for an unknown id', async () => {
    const res = await authedRequest(app).patch('/sightings/does-not-exist').send({ notes: 'x' });

    expect(res.status).toBe(404);
  });
});

describe('PATCH /sightings/:id — ownership', () => {
  it("returns 404 for another user's sighting", async () => {
    const created = await authedRequest(app).post('/sightings').send({
      species: 'cat',
      lat: 0,
      lng: 0,
    });

    await createTestUser(); // switches the module-level "current" token to a second user
    const res = await authedRequest(app)
      .patch(`/sightings/${created.body.id}`)
      .send({ notes: 'hijacked' });

    expect(res.status).toBe(404);
  });
});
