import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../src/app';

describe('app', () => {
  it('returns 404 json for an unknown route', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});
