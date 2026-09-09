import { describe, expect, it } from 'vitest';
import {
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from '../../src/auth/tokens';

describe('access tokens', () => {
  it('round-trips the userId through sign and verify', () => {
    const token = signAccessToken({ userId: 'user-123' });
    expect(verifyAccessToken(token)).toEqual({ userId: 'user-123' });
  });

  it('throws for a tampered token', () => {
    const token = signAccessToken({ userId: 'user-123' });
    expect(() => verifyAccessToken(`${token}tampered`)).toThrow();
  });
});

describe('refresh tokens', () => {
  it('generates a token whose hash matches hashRefreshToken', () => {
    const { token, hash } = generateRefreshToken();
    expect(hashRefreshToken(token)).toBe(hash);
  });

  it('generates a future expiresAt', () => {
    const { expiresAt } = generateRefreshToken();
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('generates unique tokens on each call', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a.token).not.toBe(b.token);
  });
});
