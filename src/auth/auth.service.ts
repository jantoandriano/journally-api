import { prisma } from '../db';
import { hashPassword, verifyPassword } from './password';
import { generateRefreshToken, hashRefreshToken, signAccessToken } from './tokens';
import type { LoginInput, SignupInput } from './auth.schema';

export class AuthError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

function shapeUser(user: { id: string; email: string }) {
  return { id: user.id, email: user.email };
}

async function issueTokenPair(userId: string, deviceInfo: string | undefined) {
  const accessToken = signAccessToken({ userId });
  const { token: refreshToken, hash, expiresAt } = generateRefreshToken();

  await prisma.refreshToken.create({
    data: { userId, tokenHash: hash, deviceInfo, expiresAt },
  });

  return { accessToken, refreshToken };
}

export async function signup(input: SignupInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AuthError('Email already in use', 'email_taken');

  const user = await prisma.user.create({
    data: { email: input.email, passwordHash: await hashPassword(input.password) },
  });

  const tokens = await issueTokenPair(user.id, input.deviceInfo);
  return { user: shapeUser(user), ...tokens };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !(await verifyPassword(user.passwordHash, input.password))) {
    throw new AuthError('Invalid email or password', 'invalid_credentials');
  }

  const tokens = await issueTokenPair(user.id, input.deviceInfo);
  return { user: shapeUser(user), ...tokens };
}

export async function refresh(rawToken: string) {
  const hash = hashRefreshToken(rawToken);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash: hash } });

  if (!existing) {
    throw new AuthError('Invalid refresh token', 'refresh_token_invalid');
  }

  if (existing.revokedAt) {
    // Already-rotated token replayed — treat as theft: kill every live
    // session for this user so the legitimate device has to re-login.
    await prisma.refreshToken.updateMany({
      where: { userId: existing.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new AuthError('Refresh token reuse detected', 'refresh_token_reused');
  }

  if (existing.expiresAt < new Date()) {
    throw new AuthError('Refresh token expired', 'refresh_token_expired');
  }

  const accessToken = signAccessToken({ userId: existing.userId });
  const { token: newRefreshToken, hash: newHash, expiresAt } = generateRefreshToken();

  const created = await prisma.refreshToken.create({
    data: {
      userId: existing.userId,
      tokenHash: newHash,
      deviceInfo: existing.deviceInfo,
      expiresAt,
    },
  });

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date(), replacedBy: created.id },
  });

  return { accessToken, refreshToken: newRefreshToken };
}

export async function logout(rawToken: string) {
  const hash = hashRefreshToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function logoutAll(userId: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
