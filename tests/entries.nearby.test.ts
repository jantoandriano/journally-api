import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../src/app';

describe('GET /entries/nearby', () => {
  it('returns only entries within radiusKm, sorted nearest first, with distanceKm attached', async () => {
    const near = await request(app).post('/entries').send({
      placeName: 'Near Cafe',
      neighborhood: 'Origin',
      city: 'Testville',
      lat: 0.009,
      lng: 0,
    }); // ~1km from origin
    const far = await request(app).post('/entries').send({
      placeName: 'Far Cafe',
      neighborhood: 'Origin',
      city: 'Testville',
      lat: 0.45,
      lng: 0,
    }); // ~50km from origin

    const small = await request(app).get('/entries/nearby').query({ lat: 0, lng: 0, radiusKm: 5 });
    expect(small.status).toBe(200);
    expect(small.body.map((e: { id: string }) => e.id)).toEqual([near.body.id]);
    expect(typeof small.body[0].distanceKm).toBe('number');
    expect(small.body[0].distanceKm).toBeLessThan(5);

    const big = await request(app).get('/entries/nearby').query({ lat: 0, lng: 0, radiusKm: 100 });
    expect(big.body.map((e: { id: string }) => e.id)).toEqual([near.body.id, far.body.id]);
  });

  it('defaults radiusKm to 5 when omitted', async () => {
    const near = await request(app).post('/entries').send({
      placeName: 'Near Cafe',
      neighborhood: 'Origin',
      city: 'Testville',
      lat: 0.009,
      lng: 0,
    });
    await request(app).post('/entries').send({
      placeName: 'Far Cafe',
      neighborhood: 'Origin',
      city: 'Testville',
      lat: 0.45,
      lng: 0,
    });

    const res = await request(app).get('/entries/nearby').query({ lat: 0, lng: 0 });

    expect(res.body.map((e: { id: string }) => e.id)).toEqual([near.body.id]);
  });

  it('rejects a request missing lat/lng', async () => {
    const res = await request(app).get('/entries/nearby').query({ radiusKm: 5 });
    expect(res.status).toBe(400);
  });

  it('does not treat "nearby" as an :id lookup', async () => {
    const res = await request(app).get('/entries/nearby').query({ lat: 0, lng: 0, radiusKm: 5 });
    expect(res.status).not.toBe(404);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
