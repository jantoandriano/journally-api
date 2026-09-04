import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../src/app';

describe('POST /sightings', () => {
  it('creates a sighting and returns it shaped for the client', async () => {
    const res = await request(app).post('/sightings').send({
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
    const res = await request(app).post('/sightings').send({
      species: 'dog',
      lat: 40.7128,
      lng: -74.006,
    });

    expect(res.status).toBe(201);
    expect(res.body.notes).toBeNull();
  });

  it('rejects an unknown species', async () => {
    const res = await request(app).post('/sightings').send({
      species: 'raccoon',
      lat: 0,
      lng: 0,
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid sighting');
  });

  it('rejects a body missing lat/lng', async () => {
    const res = await request(app).post('/sightings').send({ species: 'cat' });

    expect(res.status).toBe(400);
  });
});
