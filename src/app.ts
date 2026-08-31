import express from 'express';

export const app = express();

app.use(express.json());

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});
