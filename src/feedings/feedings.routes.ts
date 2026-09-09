import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { createFeedingLogEntrySchema } from './feedings.schema';
import { createFeedingLogEntry, listFeedingLog } from './feedings.service';

export const feedingsRouter = Router({ mergeParams: true });

feedingsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const entries = await listFeedingLog(req.userId!, req.params.sightingId);
    if (!entries) {
      res.status(404).json({ error: 'Sighting not found' });
      return;
    }
    res.json(entries);
  })
);

feedingsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = createFeedingLogEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid feeding log entry', details: parsed.error.issues });
      return;
    }

    const entry = await createFeedingLogEntry(req.userId!, req.params.sightingId, parsed.data);
    if (!entry) {
      res.status(404).json({ error: 'Sighting not found' });
      return;
    }
    res.status(201).json(entry);
  })
);
