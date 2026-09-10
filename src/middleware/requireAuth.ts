import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../auth/tokens';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }

  try {
    const { userId } = verifyAccessToken(header.slice('Bearer '.length));
    req.userId = userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired access token' });
  }
}

/**
 * Reads req.userId, set by requireAuth. Route handlers use this instead of
 * a `req.userId!` non-null assertion: the `!` is erased at runtime and
 * provides no actual protection — if requireAuth were ever accidentally
 * dropped from a route mount, `req.userId` would be `undefined` and every
 * `where: { userId }` Prisma query would silently drop the filter
 * (Prisma treats `undefined` as "no constraint"), leaking every user's
 * data. This helper converts that failure mode into a loud error instead.
 */
export function requireUserId(req: Request): string {
  if (!req.userId) {
    throw new Error(
      'requireUserId() called but req.userId is not set — is requireAuth mounted on this route?'
    );
  }
  return req.userId;
}
