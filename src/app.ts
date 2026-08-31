import express from 'express';
import { errorHandler } from './middleware/errorHandler';

export const app = express();

app.use(express.json());

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);
