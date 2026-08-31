import { app } from './app';

const port = process.env.PORT ?? 3000;

app.listen(port, () => {
  console.log(`journally-api listening on port ${port}`);
});
