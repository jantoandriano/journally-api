import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../../src/app';

describe('POST /auth/signup', () => {
  it('creates a user and returns a token pair', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({ email: 'new@example.com', password: 'Password123!' });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'new@example.com' });
    expect(res.body.user.id).toEqual(expect.any(String));
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
  });

  it('rejects a duplicate email', async () => {
    await request(app)
      .post('/auth/signup')
      .send({ email: 'dupe@example.com', password: 'Password123!' });

    const res = await request(app)
      .post('/auth/signup')
      .send({ email: 'dupe@example.com', password: 'Password123!' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('email_taken');
  });

  it('rejects a short password', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({ email: 'short@example.com', password: 'short' });

    expect(res.status).toBe(400);
  });

  it('rejects an invalid email', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({ email: 'not-an-email', password: 'Password123!' });

    expect(res.status).toBe(400);
  });
});
