import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi } from 'vitest';
import { asyncHandler } from '../src/middleware/asyncHandler';
import { errorHandler } from '../src/middleware/errorHandler';

function buildTestApp() {
  const app = express();
  app.get(
    '/boom',
    asyncHandler(async () => {
      throw new Error('boom');
    })
  );
  app.use(errorHandler);
  return app;
}

describe('errorHandler + asyncHandler', () => {
  it('turns a thrown async error into a 500 json response', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = buildTestApp();

    const res = await request(app).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });
});
