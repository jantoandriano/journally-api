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
