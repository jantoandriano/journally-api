import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireUserId } from '../middleware/requireAuth';
import { createEntrySchema, nearbyEntryQuerySchema, updateEntrySchema } from './entries.schema';
import {
  createEntry,
  deleteEntry,
  getEntryById,
  listEntries,
  listNearbyEntries,
  updateEntry,
} from './entries.service';

export const entriesRouter = Router();

entriesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const entries = await listEntries(requireUserId(req));
    res.json(entries);
  })
);

entriesRouter.get(
  '/nearby',
  asyncHandler(async (req, res) => {
    const parsed = nearbyEntryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query', details: parsed.error.issues });
      return;
    }

    const entries = await listNearbyEntries(requireUserId(req), parsed.data);
    res.json(entries);
  })
);

entriesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const entry = await getEntryById(requireUserId(req), req.params.id);
    if (!entry) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }
    res.json(entry);
  })
);

entriesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const deleted = await deleteEntry(requireUserId(req), req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }
    res.status(204).send();
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

    const entry = await createEntry(requireUserId(req), parsed.data);
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

    const entry = await updateEntry(requireUserId(req), req.params.id, parsed.data);
    if (!entry) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }
    res.json(entry);
  })
);
