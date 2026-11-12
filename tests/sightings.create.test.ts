import { describe, it, expect } from 'vitest';
import { app } from '../src/app';
import { authedRequest } from './helpers/testAuth';

describe('POST /sightings', () => {
  it('creates a sighting and returns it shaped for the client', async () => {
    const res = await authedRequest(app).post('/sightings').send({
      species: 'cat',
      lat: 37.7749,
      lng: -122.4194,
      notes: 'Orange tabby near the park entrance',
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      species: 'cat',
      lat: 37.7749,
      lng: -122.4194,
      notes: 'Orange tabby near the park entrance',
      fed: false,
      fedAt: null,
      photoUrls: [],
    });
    expect(res.body.id).toEqual(expect.any(String));
  });

  it('creates a sighting without notes', async () => {
    const res = await authedRequest(app).post('/sightings').send({
      species: 'dog',
      lat: 40.7128,
      lng: -74.006,
    });

    expect(res.status).toBe(201);
    expect(res.body.notes).toBeNull();
  });

  it('rejects an unknown species', async () => {
    const res = await authedRequest(app).post('/sightings').send({
      species: 'raccoon',
      lat: 0,
      lng: 0,
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid sighting');
  });

  it('rejects a body missing lat/lng', async () => {
    const res = await authedRequest(app).post('/sightings').send({ species: 'cat' });

    expect(res.status).toBe(400);
  });

  it('stores a trimmed placeName and reports isMine', async () => {
    const res = await authedRequest(app)
      .post('/sightings')
      .send({ species: 'cat', lat: 0, lng: 0, placeName: '  Jl. Kemang Raya, Jakarta  ' });

    expect(res.status).toBe(201);
    expect(res.body.placeName).toBe('Jl. Kemang Raya, Jakarta');
    expect(res.body.isMine).toBe(true);
    expect(res.body).not.toHaveProperty('userId');
  });

  it('stores null for a missing or whitespace-only placeName', async () => {
    const none = await authedRequest(app).post('/sightings').send({ species: 'cat', lat: 0, lng: 0 });
    const blank = await authedRequest(app)
      .post('/sightings')
      .send({ species: 'cat', lat: 0, lng: 0, placeName: '   ' });

    expect(none.body.placeName).toBeNull();
    expect(blank.body.placeName).toBeNull();
  });

  it('rejects a placeName longer than 200 characters', async () => {
    const res = await authedRequest(app)
      .post('/sightings')
      .send({ species: 'cat', lat: 0, lng: 0, placeName: 'x'.repeat(201) });

    expect(res.status).toBe(400);
  });
});
