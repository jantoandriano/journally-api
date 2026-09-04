import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../src/app';

async function createSighting() {
  const res = await request(app).post('/sightings').send({ species: 'cat', lat: 0, lng: 0 });
  return res.body;
}

describe('POST /sightings/:sightingId/photos', () => {
  it('uploads a photo and serves it back from /uploads', async () => {
    const sighting = await createSighting();

    const uploadRes = await request(app)
      .post(`/sightings/${sighting.id}/photos`)
      .attach('photo', Buffer.from([0xff, 0xd8, 0xff, 0xd9]), {
        filename: 'stray.jpg',
        contentType: 'image/jpeg',
      });

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.url).toMatch(/^\/uploads\/.+\.jpg$/);

    const fileRes = await request(app).get(uploadRes.body.url);
    expect(fileRes.status).toBe(200);
  });

  it('rejects a non-image file', async () => {
    const sighting = await createSighting();

    const res = await request(app)
      .post(`/sightings/${sighting.id}/photos`)
      .attach('photo', Buffer.from('not an image'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown sighting', async () => {
    const res = await request(app)
      .post('/sightings/does-not-exist/photos')
      .attach('photo', Buffer.from([0xff, 0xd8, 0xff, 0xd9]), {
        filename: 'stray.jpg',
        contentType: 'image/jpeg',
      });

    expect(res.status).toBe(404);
  });

  it('deleting the sighting also deletes the uploaded photo file', async () => {
    const sighting = await createSighting();
    const uploadRes = await request(app)
      .post(`/sightings/${sighting.id}/photos`)
      .attach('photo', Buffer.from([0xff, 0xd8, 0xff, 0xd9]), {
        filename: 'stray.jpg',
        contentType: 'image/jpeg',
      });

    await request(app).delete(`/sightings/${sighting.id}`);

    const fileRes = await request(app).get(uploadRes.body.url);
    expect(fileRes.status).toBe(404);
  });
});
