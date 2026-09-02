import cors from 'cors';
import express from 'express';
import { entriesRouter } from './entries/entries.routes';
import { errorHandler } from './middleware/errorHandler';
import { photosRouter } from './photos/photos.routes';
import { uploadsDir } from './uploads';

export const app = express();

app.use(cors());
app.use(express.json());

app.use('/entries/:entryId/photos', photosRouter);
app.use('/entries', entriesRouter);
app.use('/uploads', express.static(uploadsDir));

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);
