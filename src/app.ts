import cors from 'cors';
import express from 'express';
import { authRouter } from './auth/auth.routes';
import { entriesRouter } from './entries/entries.routes';
import { feedingsRouter } from './feedings/feedings.routes';
import { errorHandler } from './middleware/errorHandler';
import { requireAuth } from './middleware/requireAuth';
import { photosRouter } from './photos/photos.routes';
import { sightingPhotosRouter } from './sighting-photos/sightingPhotos.routes';
import { sightingsRouter } from './sightings/sightings.routes';
import { uploadsDir } from './uploads';

export const app = express();

app.use(cors());
app.use(express.json());

app.use('/auth', authRouter);

app.use('/entries/:entryId/photos', photosRouter);
app.use('/entries', requireAuth, entriesRouter);
app.use('/sightings/:sightingId/photos', sightingPhotosRouter);
app.use('/sightings/:sightingId/feedings', feedingsRouter);
app.use('/sightings', requireAuth, sightingsRouter);
app.use('/uploads', express.static(uploadsDir));

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);
