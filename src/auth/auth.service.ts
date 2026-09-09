import { prisma } from '../db';
import { hashPassword, verifyPassword } from './password';
import { generateRefreshToken, signAccessToken } from './tokens';
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
