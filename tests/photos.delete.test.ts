import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../src/app';

async function createEntryWithPhoto() {
  const entryRes = await request(app).post('/entries').send({
    placeName: 'Blue Bottle',
    neighborhood: 'Hayes Valley',
    city: 'San Francisco',
    orderItems: [],
  });
  const photoRes = await request(app)
    .post(`/entries/${entryRes.body.id}/photos`)
    .attach('photo', Buffer.from([0xff, 0xd8, 0xff, 0xd9]), {
      filename: 'cafe.jpg',
      contentType: 'image/jpeg',
    });
  return { entry: entryRes.body, photo: photoRes.body };
}

describe('DELETE /entries/:entryId/photos/:photoId', () => {
  it('deletes the photo row and its file', async () => {
    const { entry, photo } = await createEntryWithPhoto();

    const res = await request(app).delete(`/entries/${entry.id}/photos/${photo.id}`);
    expect(res.status).toBe(204);

    const fileRes = await request(app).get(photo.url);
    expect(fileRes.status).toBe(404);
  });

  it('returns 404 for an unknown photo id', async () => {
    const { entry } = await createEntryWithPhoto();

    const res = await request(app).delete(`/entries/${entry.id}/photos/does-not-exist`);
    expect(res.status).toBe(404);
  });
});
