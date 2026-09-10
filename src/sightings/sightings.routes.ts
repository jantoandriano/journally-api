import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { requireUserId } from '../middleware/requireAuth';
import {
  createSightingSchema,
  nearbySightingQuerySchema,
  updateSightingSchema,
} from './sightings.schema';
import {
  createSighting,
  deleteSighting,
  getSightingById,
  listNearbySightings,
  listSightings,
  updateSighting,
} from './sightings.service';

export const sightingsRouter = Router();

sightingsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const sightings = await listSightings(requireUserId(req));
    res.json(sightings);
  })
);

sightingsRouter.get(
  '/nearby',
  asyncHandler(async (req, res) => {
    const parsed = nearbySightingQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query', details: parsed.error.issues });
      return;
    }

    const sightings = await listNearbySightings(requireUserId(req), parsed.data);
    res.json(sightings);
  })
);

sightingsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const sighting = await getSightingById(requireUserId(req), req.params.id);
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

    const sighting = await createSighting(requireUserId(req), parsed.data);
    res.status(201).json(sighting);
  })
);

sightingsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const parsed = updateSightingSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid sighting', details: parsed.error.issues });
      return;
    }

    const sighting = await updateSighting(requireUserId(req), req.params.id, parsed.data);
    if (!sighting) {
      res.status(404).json({ error: 'Sighting not found' });
      return;
    }
    res.json(sighting);
  })
);

sightingsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const deleted = await deleteSighting(requireUserId(req), req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Sighting not found' });
      return;
    }
    res.status(204).send();
  })
);
