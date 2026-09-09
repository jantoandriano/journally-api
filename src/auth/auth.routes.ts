import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireAuth } from '../middleware/requireAuth';
import { loginSchema, logoutSchema, refreshSchema, signupSchema } from './auth.schema';
import { AuthError, login, logout, logoutAll, refresh, signup } from './auth.service';

export const authRouter = Router();

authRouter.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid signup', details: parsed.error.issues });
      return;
    }
    try {
      const result = await signup(parsed.data);
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof AuthError) {
        res.status(409).json({ error: err.message, code: err.code });
        return;
      }
      throw err;
    }
  })
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid login', details: parsed.error.issues });
      return;
    }
    try {
      const result = await login(parsed.data);
      res.json(result);
    } catch (err) {
      if (err instanceof AuthError) {
        res.status(401).json({ error: err.message, code: err.code });
        return;
      }
      throw err;
    }
  })
);

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid refresh request', details: parsed.error.issues });
      return;
    }
    try {
      const result = await refresh(parsed.data.refreshToken);
      res.json(result);
    } catch (err) {
      if (err instanceof AuthError) {
        res.status(401).json({ error: err.message, code: err.code });
        return;
      }
      throw err;
    }
  })
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const parsed = logoutSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid logout request', details: parsed.error.issues });
      return;
    }
    await logout(parsed.data.refreshToken);
    res.status(204).send();
  })
);

authRouter.post(
  '/logout-all',
  requireAuth,
  asyncHandler(async (req, res) => {
    await logoutAll(req.userId!);
    res.status(204).send();
  })
);
