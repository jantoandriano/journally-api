import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../src/app';

describe('notes, rating, attributes, order item note, photoCount', () => {
  it('accepts and returns notes, rating, attributes, and order item note on create', async () => {
    const res = await request(app)
      .post('/entries')
      .send({
        placeName: 'Blue Bottle',
        neighborhood: 'Hayes Valley',
        city: 'San Francisco',
        notes: 'Cozy spot, great oat milk latte',
        rating: 4.5,
        attributes: ['outdoor seating', 'wifi'],
        orderItems: [{ name: 'Latte', price: 5.5, note: 'extra hot' }],
      });

    expect(res.status).toBe(201);
    expect(res.body.notes).toBe('Cozy spot, great oat milk latte');
    expect(res.body.rating).toBe(4.5);
    expect(res.body.attributes).toEqual(['outdoor seating', 'wifi']);
    expect(res.body.orderItems).toEqual([{ name: 'Latte', price: 5.5, note: 'extra hot' }]);
    expect(res.body.photoCount).toBe(0);
  });

  it('accepts an empty notes string', async () => {
    const res = await request(app).post('/entries').send({
      placeName: 'Blue Bottle',
      neighborhood: 'Hayes Valley',
      city: 'San Francisco',
      notes: '',
      orderItems: [],
    });

    expect(res.status).toBe(201);
    expect(res.body.notes).toBe('');
  });

  it('defaults notes/rating to null and attributes to [] when omitted', async () => {
    const res = await request(app).post('/entries').send({
      placeName: 'Blue Bottle',
      neighborhood: 'Hayes Valley',
      city: 'San Francisco',
      orderItems: [],
    });

    expect(res.status).toBe(201);
    expect(res.body.notes).toBeNull();
    expect(res.body.rating).toBeNull();
    expect(res.body.attributes).toEqual([]);
  });

  it('rejects a rating above 5', async () => {
    const res = await request(app).post('/entries').send({
      placeName: 'Blue Bottle',
      neighborhood: 'Hayes Valley',
      city: 'San Francisco',
      orderItems: [],
      rating: 5.5,
    });

    expect(res.status).toBe(400);
  });

  it('updates notes, rating, and attributes via PATCH', async () => {
    const created = await request(app).post('/entries').send({
      placeName: 'Blue Bottle',
      neighborhood: 'Hayes Valley',
      city: 'San Francisco',
      orderItems: [],
    });

    const res = await request(app)
      .patch(`/entries/${created.body.id}`)
      .send({ notes: 'Updated', rating: 3, attributes: ['quiet'] });

    expect(res.status).toBe(200);
    expect(res.body.notes).toBe('Updated');
    expect(res.body.rating).toBe(3);
    expect(res.body.attributes).toEqual(['quiet']);
  });
});
