import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../../src/app';

async function signup(email: string) {
  const res = await request(app)
    .post('/auth/signup')
    .send({ email, password: 'Password123!' });
  return res.body as { accessToken: string; refreshToken: string };
}

describe('POST /auth/refresh', () => {
  it('rotates the refresh token and returns a new access token', async () => {
    const { refreshToken } = await signup('refresh@example.com');

    const res = await request(app).post('/auth/refresh').send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).not.toBe(refreshToken);
  });

  it('accepts the newly rotated token for a second refresh', async () => {
    const { refreshToken } = await signup('rotate-twice@example.com');
    const first = await request(app).post('/auth/refresh').send({ refreshToken });

    const second = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: first.body.refreshToken });

    expect(second.status).toBe(200);
  });

  it('rejects an unknown refresh token', async () => {
    const res = await request(app).post('/auth/refresh').send({ refreshToken: 'not-a-real-token' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('refresh_token_invalid');
  });

  it('detects reuse of an already-rotated token and revokes the session', async () => {
    const { refreshToken } = await signup('reuse@example.com');
    await request(app).post('/auth/refresh').send({ refreshToken });

    // Replaying the original (now-rotated) token is theft-shaped.
    const replay = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(replay.status).toBe(401);
    expect(replay.body.code).toBe('refresh_token_reused');

    // The rotated-in token from the first call is also dead now.
    const firstRefresh = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(firstRefresh.status).toBe(401);
  });
});
