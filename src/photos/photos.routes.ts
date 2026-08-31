import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { addPhoto, upload } from './photos.service';

export const photosRouter = Router({ mergeParams: true });

photosRouter.post(
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

    const photo = await addPhoto(req.params.entryId, req.file.filename);
    if (!photo) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }

    res.status(201).json(photo);
  })
);
