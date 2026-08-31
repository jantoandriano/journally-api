import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../src/app';

describe('PATCH /entries/:id', () => {
  it('updates only the fields provided', async () => {
    const created = await request(app).post('/entries').send({
      placeName: 'Blue Bottle',
      neighborhood: 'Hayes Valley',
      city: 'San Francisco',
      orderItems: ['Latte'],
    });

    const res = await request(app)
      .patch(`/entries/${created.body.id}`)
      .send({ placeName: 'Blue Bottle Coffee' });

    expect(res.status).toBe(200);
    expect(res.body.placeName).toBe('Blue Bottle Coffee');
    expect(res.body.neighborhood).toBe('Hayes Valley');
    expect(res.body.orderItems).toEqual(['Latte']);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).patch('/entries/does-not-exist').send({ placeName: 'X' });

    expect(res.status).toBe(404);
  });
});
