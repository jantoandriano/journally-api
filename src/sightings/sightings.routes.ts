import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { createSightingSchema } from './sightings.schema';
import { createSighting, getSightingById, listSightings } from './sightings.service';

export const sightingsRouter = Router();

sightingsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const sightings = await listSightings();
    res.json(sightings);
  })
);

sightingsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const sighting = await getSightingById(req.params.id);
    if (!sighting) {
      res.status(404).json({ error: 'Sighting not found' });
      return;
    }
    res.json(sighting);
  })
);

sightingsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = createSightingSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid sighting', details: parsed.error.issues });
      return;
    }

    const sighting = await createSighting(parsed.data);
    res.status(201).json(sighting);
  })
);
