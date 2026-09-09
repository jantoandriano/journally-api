import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '../../src/db';
import { hashPassword } from '../../src/auth/password';
import { signAccessToken } from '../../src/auth/tokens';

let currentToken: string | undefined;

export async function createTestUser(email?: string) {
  const user = await prisma.user.create({
    data: {
      email: email ?? `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
      passwordHash: await hashPassword('Password123!'),
    },
  });
  const accessToken = signAccessToken({ userId: user.id });
  currentToken = accessToken;
  return { user, accessToken };
}

export function authHeader(token: string = currentToken!) {
  return { Authorization: `Bearer ${token}` };
}

/**
 * Drop-in replacement for supertest's `request(app)` that auto-attaches the
 * most recently created test user's token (see `createTestUser`). Tests
 * that need a specific *other* token, or no token at all, use plain
 * `supertest`'s `request(app)` and `.set()`/omit the header themselves.
 */
export function authedRequest(app: Express) {
  const agent = request(app);
  const withAuth = (test: request.Test) => test.set(authHeader());
  return {
    get: (url: string) => withAuth(agent.get(url)),
    post: (url: string) => withAuth(agent.post(url)),
    patch: (url: string) => withAuth(agent.patch(url)),
    delete: (url: string) => withAuth(agent.delete(url)),
  };
}
