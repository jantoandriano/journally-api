import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../src/app';

async function createSightingWithPhoto() {
  const sightingRes = await request(app).post('/sightings').send({ species: 'dog', lat: 0, lng: 0 });
  const photoRes = await request(app)
    .post(`/sightings/${sightingRes.body.id}/photos`)
    .attach('photo', Buffer.from([0xff, 0xd8, 0xff, 0xd9]), {
      filename: 'stray.jpg',
      contentType: 'image/jpeg',
    });
  return { sighting: sightingRes.body, photo: photoRes.body };
}

describe('DELETE /sightings/:sightingId/photos/:photoId', () => {
  it('deletes the photo row and its file', async () => {
    const { sighting, photo } = await createSightingWithPhoto();

    const res = await request(app).delete(`/sightings/${sighting.id}/photos/${photo.id}`);
    expect(res.status).toBe(204);

    const fileRes = await request(app).get(photo.url);
    expect(fileRes.status).toBe(404);
  });

  it('returns 404 for an unknown photo id', async () => {
    const { sighting } = await createSightingWithPhoto();

    const res = await request(app).delete(`/sightings/${sighting.id}/photos/does-not-exist`);
    expect(res.status).toBe(404);
  });
});
