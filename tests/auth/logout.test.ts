import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../../src/app';

async function signup(email: string) {
  const res = await request(app)
    .post('/auth/signup')
    .send({ email, password: 'Password123!' });
  return res.body as { accessToken: string; refreshToken: string };
}

describe('POST /auth/logout', () => {
  it('revokes the given refresh token', async () => {
    const { refreshToken } = await signup('logout@example.com');

    const logoutRes = await request(app).post('/auth/logout').send({ refreshToken });
    expect(logoutRes.status).toBe(204);

    const refreshRes = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(refreshRes.status).toBe(401);
  });
});

describe('POST /auth/logout — unknown token', () => {
  it('still returns 204 for an unknown refresh token', async () => {
    const res = await request(app).post('/auth/logout').send({ refreshToken: 'not-a-real-token' });
    expect(res.status).toBe(204);
  });
});

describe('POST /auth/logout-all', () => {
  it('revokes every refresh token for the user', async () => {
    const { accessToken, refreshToken: firstToken } = await signup('logout-all@example.com');
    const secondLogin = await request(app)
      .post('/auth/login')
      .send({ email: 'logout-all@example.com', password: 'Password123!' });

    const logoutAllRes = await request(app)
      .post('/auth/logout-all')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(logoutAllRes.status).toBe(204);

    const firstRefresh = await request(app).post('/auth/refresh').send({ refreshToken: firstToken });
    expect(firstRefresh.status).toBe(401);

    const secondRefresh = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: secondLogin.body.refreshToken });
    expect(secondRefresh.status).toBe(401);
  });

  it('requires a valid access token', async () => {
    const res = await request(app).post('/auth/logout-all');
    expect(res.status).toBe(401);
  });
});
