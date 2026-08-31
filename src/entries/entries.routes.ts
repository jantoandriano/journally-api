import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { createEntrySchema } from './entries.schema';
import { createEntry } from './entries.service';

export const entriesRouter = Router();

entriesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = createEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid entry', details: parsed.error.issues });
      return;
    }

    const entry = await createEntry(parsed.data);
    res.status(201).json(entry);
  })
);
