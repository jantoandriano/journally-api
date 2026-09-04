import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { uploadsDir } from '../uploads';
import { addSightingPhoto, deleteSightingPhoto, upload } from './sightingPhotos.service';

export const sightingPhotosRouter = Router({ mergeParams: true });

sightingPhotosRouter.post(
  '/',
  (req, res, next) => {
    upload.single('photo')(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err.message });
        return;
      }
      next();
    });
  },
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'photo file is required' });
      return;
    }

    const photo = await addSightingPhoto(req.params.sightingId, req.file.filename);
    if (!photo) {
      try {
        await unlink(path.join(uploadsDir, req.file.filename));
      } catch (err) {
        console.warn(`Failed to remove orphaned photo file ${req.file.filename}`, err);
      }
      res.status(404).json({ error: 'Sighting not found' });
      return;
    }

    res.status(201).json(photo);
  })
);

sightingPhotosRouter.delete(
  '/:photoId',
  asyncHandler(async (req, res) => {
    const deleted = await deleteSightingPhoto(req.params.sightingId, req.params.photoId);
    if (!deleted) {
      res.status(404).json({ error: 'Photo not found' });
      return;
    }
    res.status(204).send();
  })
);
