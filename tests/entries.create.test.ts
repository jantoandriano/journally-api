import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../src/app';

describe('POST /entries', () => {
  it('creates an entry and returns it shaped for the client', async () => {
    const res = await request(app).post('/entries').send({
      placeName: 'Blue Bottle',
      neighborhood: 'Hayes Valley',
      city: 'San Francisco',
      orderItems: [
        { name: 'Oat milk latte', price: 5.5 },
        { name: 'Croissant' },
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      placeName: 'Blue Bottle',
      neighborhood: 'Hayes Valley',
      city: 'San Francisco',
      orderItems: [
        { name: 'Oat milk latte', price: 5.5 },
        { name: 'Croissant', price: null },
      ],
      photoUrls: [],
    });
    expect(res.body.id).toEqual(expect.any(String));
  });

  it('rejects a negative order item price', async () => {
    const res = await request(app).post('/entries').send({
      placeName: 'Blue Bottle',
      neighborhood: 'Hayes Valley',
      city: 'San Francisco',
      orderItems: [{ name: 'Latte', price: -1 }],
    });

    expect(res.status).toBe(400);
  });

  it('accepts and stores optional lat/lng/placeId', async () => {
    const res = await request(app).post('/entries').send({
      placeName: 'Blue Bottle',
      neighborhood: 'Hayes Valley',
      city: 'San Francisco',
      orderItems: [],
      lat: 37.7764,
      lng: -122.4266,
      placeId: 'ChIJ-place-id',
    });

    expect(res.status).toBe(201);
    expect(res.body.lat).toBe(37.7764);
    expect(res.body.lng).toBe(-122.4266);
    expect(res.body.placeId).toBe('ChIJ-place-id');
  });

  it('defaults lat/lng/placeId to null when omitted', async () => {
    const res = await request(app).post('/entries').send({
      placeName: 'Blue Bottle',
      neighborhood: 'Hayes Valley',
      city: 'San Francisco',
      orderItems: [],
    });

    expect(res.status).toBe(201);
    expect(res.body.lat).toBeNull();
    expect(res.body.lng).toBeNull();
    expect(res.body.placeId).toBeNull();
  });

  it('rejects an out-of-range lat', async () => {
    const res = await request(app).post('/entries').send({
      placeName: 'Blue Bottle',
      neighborhood: 'Hayes Valley',
      city: 'San Francisco',
      orderItems: [],
      lat: 200,
      lng: 0,
    });

    expect(res.status).toBe(400);
  });

  it('rejects a body missing placeName', async () => {
    const res = await request(app).post('/entries').send({
      neighborhood: 'Hayes Valley',
      city: 'San Francisco',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid entry');
  });
});
