import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { createEntrySchema, updateEntrySchema } from './entries.schema';
import { createEntry, getEntryById, listEntries, updateEntry } from './entries.service';

export const entriesRouter = Router();

entriesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const entries = await listEntries();
    res.json(entries);
  })
);

entriesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const entry = await getEntryById(req.params.id);
    if (!entry) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }
    res.json(entry);
  })
);

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

entriesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const parsed = updateEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid entry', details: parsed.error.issues });
      return;
    }

    const entry = await updateEntry(req.params.id, parsed.data);
    if (!entry) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }
    res.json(entry);
  })
);
