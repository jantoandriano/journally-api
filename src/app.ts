import express from 'express';
import { entriesRouter } from './entries/entries.routes';
import { errorHandler } from './middleware/errorHandler';

export const app = express();

app.use(express.json());

app.use('/entries', entriesRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);
