import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../../src/app';

async function signup(email: string, password = 'Password123!') {
  return request(app).post('/auth/signup').send({ email, password });
}

describe('POST /auth/login', () => {
  it('logs in with correct credentials', async () => {
    await signup('login@example.com');

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'login@example.com', password: 'Password123!' });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('login@example.com');
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
  });

  it('rejects a wrong password', async () => {
    await signup('wrongpw@example.com');

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'wrongpw@example.com', password: 'WrongPassword1' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('invalid_credentials');
  });

  it('rejects an unknown email', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'Password123!' });

    expect(res.status).toBe(401);
  });
});
