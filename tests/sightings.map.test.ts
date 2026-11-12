import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../src/app';
import { prisma } from '../src/db';
import { authedRequest, createTestUser } from './helpers/testAuth';

const box = { south: -1, west: -1, north: 1, east: 1 };

describe('GET /sightings/map', () => {
  it('returns sightings from every user inside the box, newest first, none outside', async () => {
    const byOther = await authedRequest(app)
      .post('/sightings')
      .send({ species: 'cat', lat: 0.1, lng: 0.1 });
    await authedRequest(app).post('/sightings').send({ species: 'cat', lat: 5, lng: 5 }); // outside
    await createTestUser(); // the caller from here on
    const byCaller = await authedRequest(app)
      .post('/sightings')
      .send({ species: 'dog', lat: -0.2, lng: 0.3 });

    const res = await authedRequest(app).get('/sightings/map').query(box);

    expect(res.status).toBe(200);
    expect(res.body.map((s: { id: string }) => s.id)).toEqual([byCaller.body.id, byOther.body.id]);
    expect(res.body[0].isMine).toBe(true);
    expect(res.body[1].isMine).toBe(false);
    for (const sighting of res.body) expect(sighting).not.toHaveProperty('userId');
  });

  it('filters by species', async () => {
    await authedRequest(app).post('/sightings').send({ species: 'cat', lat: 0, lng: 0 });
    const dog = await authedRequest(app).post('/sightings').send({ species: 'dog', lat: 0, lng: 0 });

    const res = await authedRequest(app)
      .get('/sightings/map')
      .query({ ...box, species: 'dog' });

    expect(res.body.map((s: { id: string }) => s.id)).toEqual([dog.body.id]);
  });

  it('fed=false returns only sightings with no feeding entry today', async () => {
    const fed = await authedRequest(app).post('/sightings').send({ species: 'cat', lat: 0, lng: 0 });
    const hungry = await authedRequest(app)
      .post('/sightings')
      .send({ species: 'cat', lat: 0, lng: 0 });
    await authedRequest(app).post(`/sightings/${fed.body.id}/feedings`).send({});

    const res = await authedRequest(app)
      .get('/sightings/map')
      .query({ ...box, fed: 'false' });

    expect(res.body.map((s: { id: string }) => s.id)).toEqual([hungry.body.id]);
  });

  it('includes sightings exactly on the box edge', async () => {
    const edge = await authedRequest(app).post('/sightings').send({ species: 'cat', lat: 1, lng: -1 });

    const res = await authedRequest(app).get('/sightings/map').query(box);

    expect(res.body.map((s: { id: string }) => s.id)).toEqual([edge.body.id]);
  });

  it('caps the result at 300', async () => {
    const { user } = await createTestUser();
    await prisma.sighting.createMany({
      data: Array.from({ length: 301 }, () => ({
        userId: user.id,
        species: 'cat',
        lat: 0,
        lng: 0,
      })),
    });

    const res = await authedRequest(app).get('/sightings/map').query(box);

    expect(res.body).toHaveLength(300);
  });

  it.each([
    ['missing east', { south: -1, west: -1, north: 1 }],
    ['non-numeric', { ...box, south: 'abc' }],
    ['south >= north', { ...box, south: 1, north: 1 }],
    ['west >= east', { ...box, west: 2, east: 1 }],
    ['latitude out of range', { ...box, south: -91 }],
    ['longitude out of range', { ...box, east: 181 }],
    ['bad species', { ...box, species: 'bird' }],
    ['bad fed value', { ...box, fed: 'true' }],
  ])('rejects %s with 400', async (_label, query) => {
    const res = await authedRequest(app).get('/sightings/map').query(query);

    expect(res.status).toBe(400);
  });

  it('requires auth', async () => {
    const res = await request(app).get('/sightings/map').query(box);

    expect(res.status).toBe(401);
  });
});
