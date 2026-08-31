import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../src/app';

describe('POST /entries', () => {
  it('creates an entry and returns it shaped for the client', async () => {
    const res = await request(app).post('/entries').send({
      placeName: 'Blue Bottle',
      neighborhood: 'Hayes Valley',
      city: 'San Francisco',
      orderItems: ['Oat milk latte', 'Croissant'],
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      placeName: 'Blue Bottle',
      neighborhood: 'Hayes Valley',
      city: 'San Francisco',
      orderItems: ['Oat milk latte', 'Croissant'],
      photoUrls: [],
    });
    expect(res.body.id).toEqual(expect.any(String));
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
