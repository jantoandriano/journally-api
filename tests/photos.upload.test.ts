import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../src/app';

async function createEntry() {
  const res = await request(app).post('/entries').send({
    placeName: 'Blue Bottle',
    neighborhood: 'Hayes Valley',
    city: 'San Francisco',
    orderItems: [],
  });
  return res.body;
}

describe('POST /entries/:entryId/photos', () => {
  it('uploads a photo and serves it back from /uploads', async () => {
    const entry = await createEntry();

    const uploadRes = await request(app)
      .post(`/entries/${entry.id}/photos`)
      .attach('photo', Buffer.from([0xff, 0xd8, 0xff, 0xd9]), {
        filename: 'cafe.jpg',
        contentType: 'image/jpeg',
      });

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.url).toMatch(/^\/uploads\/.+\.jpg$/);

    const fileRes = await request(app).get(uploadRes.body.url);
    expect(fileRes.status).toBe(200);
  });

  it('rejects a non-image file', async () => {
    const entry = await createEntry();

    const res = await request(app)
      .post(`/entries/${entry.id}/photos`)
      .attach('photo', Buffer.from('not an image'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown entry', async () => {
    const res = await request(app)
      .post('/entries/does-not-exist/photos')
      .attach('photo', Buffer.from([0xff, 0xd8, 0xff, 0xd9]), {
        filename: 'cafe.jpg',
        contentType: 'image/jpeg',
      });

    expect(res.status).toBe(404);
  });

  it('deleting the entry also deletes the uploaded photo file', async () => {
    const entry = await createEntry();
    const uploadRes = await request(app)
      .post(`/entries/${entry.id}/photos`)
      .attach('photo', Buffer.from([0xff, 0xd8, 0xff, 0xd9]), {
        filename: 'cafe.jpg',
        contentType: 'image/jpeg',
      });

    await request(app).delete(`/entries/${entry.id}`);

    const fileRes = await request(app).get(uploadRes.body.url);
    expect(fileRes.status).toBe(404);
  });
});
