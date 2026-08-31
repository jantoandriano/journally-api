import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../src/app';

describe('PATCH /entries/:id', () => {
  it('updates only the fields provided', async () => {
    const created = await request(app).post('/entries').send({
      placeName: 'Blue Bottle',
      neighborhood: 'Hayes Valley',
      city: 'San Francisco',
      orderItems: [{ name: 'Latte', price: 4.5 }],
    });

    const res = await request(app)
      .patch(`/entries/${created.body.id}`)
      .send({ placeName: 'Blue Bottle Coffee' });

    expect(res.status).toBe(200);
    expect(res.body.placeName).toBe('Blue Bottle Coffee');
    expect(res.body.neighborhood).toBe('Hayes Valley');
    expect(res.body.orderItems).toEqual([{ name: 'Latte', price: 4.5 }]);
  });

  it('updates lat/lng/placeId', async () => {
    const created = await request(app).post('/entries').send({
      placeName: 'Blue Bottle',
      neighborhood: 'Hayes Valley',
      city: 'San Francisco',
      orderItems: [],
    });

    const res = await request(app)
      .patch(`/entries/${created.body.id}`)
      .send({ lat: 37.7764, lng: -122.4266, placeId: 'ChIJ-place-id' });

    expect(res.status).toBe(200);
    expect(res.body.lat).toBe(37.7764);
    expect(res.body.lng).toBe(-122.4266);
    expect(res.body.placeId).toBe('ChIJ-place-id');
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).patch('/entries/does-not-exist').send({ placeName: 'X' });

    expect(res.status).toBe(404);
  });
});
