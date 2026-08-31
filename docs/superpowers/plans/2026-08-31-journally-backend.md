# Journally Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Journally backend — a Node.js + Express + TypeScript + SQLite (Prisma) API supporting full CRUD on journal entries and photo upload, replacing the Flutter client's `MockJournalRepository`.

**Architecture:** Feature-folder Express app. Route files parse/validate input (Zod) and call a sibling service file, which is the only layer that talks to Prisma. A single `errorHandler` middleware catches unexpected errors; `asyncHandler` forwards rejected promises to it. Photos are uploaded via `multer` to local disk under `/uploads` and served via `express.static`.

**Tech Stack:** Express, TypeScript, Prisma (SQLite), Zod, Multer, dotenv, tsx (dev), Vitest + Supertest (tests).

**Spec:** `docs/superpowers/specs/2026-08-31-journally-backend-design.md`

## Global Constraints

- All resource ids are UUID strings (Prisma `@default(uuid())`) — never autoincrement ints.
- Updates use PATCH semantics (partial body) — never PUT.
- `photoUrls` is computed per-response from the Photo table (`/uploads/<filePath>`) — never stored redundantly.
- `onDelete: Cascade` in Prisma handles child DB rows only; photo files on disk are deleted explicitly in application code.
- Feature-folder layout: route file → service file → Prisma, no separate controller layer.
- Every POST/PATCH body is validated with a Zod schema via `.safeParse()`; failures return `400 { error, details }`.
- Not-found lookups return `404 { error: "<Resource> not found" }` directly from the route — not thrown through `errorHandler`.
- Unexpected errors are thrown, caught only by the single `errorHandler` middleware mounted last in `app.ts`, logged server-side with `console.error`, never leaked into the response body.
- Async route handlers are wrapped in `asyncHandler` so rejected promises reach `errorHandler`.
- Tests run against `prisma/test.db` (set via `vitest.config.ts`'s `test.env.DATABASE_URL`), never `prisma/dev.db`; rows are cleared with `deleteMany` before each test.

---

## File Structure

```
package.json
tsconfig.json
vitest.config.ts
.gitignore
.env.example
.env                          # gitignored, created locally
prisma/
  schema.prisma
src/
  app.ts
  server.ts
  db.ts
  uploads.ts
  middleware/
    asyncHandler.ts
    errorHandler.ts
  entries/
    entries.schema.ts
    entries.service.ts
    entries.routes.ts
  photos/
    photos.service.ts
    photos.routes.ts
tests/
  globalSetup.ts
  setup.ts
  app.test.ts
  db.test.ts
  errorHandler.test.ts
  entries.create.test.ts
  entries.list-get.test.ts
  entries.update.test.ts
  entries.delete.test.ts
  photos.upload.test.ts
  photos.delete.test.ts
```

---

### Task 1: Project scaffolding & Express app skeleton

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `src/app.ts`
- Create: `src/server.ts`
- Test: `tests/app.test.ts`

**Interfaces:**
- Produces: `app` — a named export from `src/app.ts`, an Express `Application` instance with `express.json()` mounted and a catch-all 404 JSON handler. Every later task imports `{ app }` from `../src/app` for supertest requests, and adds routers to this file before the 404 handler.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "journally-api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "vitest run",
    "prisma:migrate": "prisma migrate dev",
    "prisma:generate": "prisma generate"
  },
  "dependencies": {
    "@prisma/client": "^5.20.0",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "multer": "^1.4.5-lts.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/multer": "^1.4.12",
    "@types/node": "^20.14.0",
    "@types/supertest": "^6.0.2",
    "prisma": "^5.20.0",
    "supertest": "^7.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `.gitignore`**

```
node_modules/
dist/
uploads/
prisma/*.db
prisma/*.db-journal
.env
```

- [ ] **Step 4: Create `.env.example`**

```
DATABASE_URL="file:./dev.db"
PORT=3000
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`
Expected: installs cleanly, creates `node_modules/` and `package-lock.json`.

- [ ] **Step 6: Write the failing test**

```typescript
// tests/app.test.ts
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../src/app';

describe('app', () => {
  it('returns 404 json for an unknown route', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npx vitest run tests/app.test.ts`
Expected: FAIL — cannot find module `../src/app`.

- [ ] **Step 8: Create `src/app.ts`**

```typescript
import express from 'express';

export const app = express();

app.use(express.json());

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});
```

- [ ] **Step 9: Create `src/server.ts`**

```typescript
import { app } from './app';

const port = process.env.PORT ?? 3000;

app.listen(port, () => {
  console.log(`journally-api listening on port ${port}`);
});
```

- [ ] **Step 10: Run test to verify it passes**

Run: `npx vitest run tests/app.test.ts`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore .env.example src/app.ts src/server.ts tests/app.test.ts
git commit -m "chore: scaffold Express + TypeScript project with a 404 smoke test"
```

---

### Task 2: Prisma schema & database client

**Files:**
- Create: `prisma/schema.prisma`
- Create: `.env` (not committed)
- Create: `src/db.ts`
- Create: `vitest.config.ts`
- Create: `tests/globalSetup.ts`
- Create: `tests/setup.ts`
- Test: `tests/db.test.ts`

**Interfaces:**
- Consumes: none new.
- Produces: `prisma` — a named export from `src/db.ts`, a `PrismaClient` singleton. Every service module in later tasks imports `{ prisma } from '../db'`. The `JournalEntry`, `OrderItem`, `Photo` Prisma models (fields exactly as below) are the types every later task's Prisma calls rely on.

- [ ] **Step 1: Create `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model JournalEntry {
  id           String      @id @default(uuid())
  placeName    String
  neighborhood String
  city         String
  visitedAt    DateTime    @default(now())
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
  orderItems   OrderItem[]
  photos       Photo[]
}

model OrderItem {
  id      String       @id @default(uuid())
  name    String
  entryId String
  entry   JournalEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)
}

model Photo {
  id        String       @id @default(uuid())
  filePath  String
  entryId   String
  entry     JournalEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)
  createdAt DateTime     @default(now())
}
```

- [ ] **Step 2: Create `.env`** (local file, gitignored — not committed)

```
DATABASE_URL="file:./dev.db"
PORT=3000
```

- [ ] **Step 3: Write the failing test**

```typescript
// tests/db.test.ts
import { describe, it, expect } from 'vitest';
import { prisma } from '../src/db';

describe('prisma client', () => {
  it('creates and fetches a journal entry', async () => {
    const entry = await prisma.journalEntry.create({
      data: {
        placeName: 'Blue Bottle',
        neighborhood: 'Hayes Valley',
        city: 'San Francisco',
      },
    });

    const found = await prisma.journalEntry.findUniqueOrThrow({
      where: { id: entry.id },
    });

    expect(found.placeName).toBe('Blue Bottle');
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run tests/db.test.ts`
Expected: FAIL — cannot find module `../src/db`.

- [ ] **Step 5: Create `src/db.ts`**

```typescript
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
```

- [ ] **Step 6: Generate the Prisma client and dev database**

Run: `npx prisma migrate dev --name init`
Expected: creates `prisma/migrations/`, `prisma/dev.db`, and generates the `@prisma/client` types.

- [ ] **Step 7: Run test to verify it passes against the dev database**

Run: `npx vitest run tests/db.test.ts`
Expected: PASS (this run writes into `prisma/dev.db` — isolation from a real dev DB is fixed in the next steps).

- [ ] **Step 8: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: 'file:./test.db',
    },
    globalSetup: './tests/globalSetup.ts',
    setupFiles: ['./tests/setup.ts'],
    // Test files share one physical SQLite file (test.db); running them
    // concurrently races beforeEach cleanup against another file's writes.
    fileParallelism: false,
  },
});
```

- [ ] **Step 9: Create `tests/globalSetup.ts`**

```typescript
import { execSync } from 'node:child_process';

export default function setup() {
  execSync('npx prisma db push --skip-generate', {
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
    stdio: 'inherit',
  });
}
```

- [ ] **Step 10: Create `tests/setup.ts`**

```typescript
import { beforeEach } from 'vitest';
import { prisma } from '../src/db';

beforeEach(async () => {
  await prisma.photo.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.journalEntry.deleteMany();
});
```

- [ ] **Step 11: Run test to verify it still passes, now isolated to `prisma/test.db`**

Run: `npx vitest run tests/db.test.ts`
Expected: PASS. `prisma/test.db` now exists alongside `prisma/dev.db`.

- [ ] **Step 12: Commit**

```bash
git add prisma/schema.prisma prisma/migrations .env.example src/db.ts vitest.config.ts tests/globalSetup.ts tests/setup.ts tests/db.test.ts .gitignore
git commit -m "feat: add Prisma schema, db client, and isolated test database"
```

---

### Task 3: Error-handling middleware

**Files:**
- Create: `src/middleware/asyncHandler.ts`
- Create: `src/middleware/errorHandler.ts`
- Modify: `src/app.ts`
- Test: `tests/errorHandler.test.ts`

**Interfaces:**
- Consumes: none new.
- Produces: `asyncHandler(handler)` from `src/middleware/asyncHandler.ts` — takes `(req, res, next) => Promise<void>`, returns an Express `RequestHandler` that forwards rejected promises to `next`. `errorHandler` from `src/middleware/errorHandler.ts` — Express error-middleware signature `(err, req, res, next) => void`, responds `500 { error: "Internal server error" }`. Every route handler in later tasks is wrapped in `asyncHandler`; `errorHandler` is mounted last in `app.ts`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/errorHandler.test.ts
import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi } from 'vitest';
import { asyncHandler } from '../src/middleware/asyncHandler';
import { errorHandler } from '../src/middleware/errorHandler';

function buildTestApp() {
  const app = express();
  app.get(
    '/boom',
    asyncHandler(async () => {
      throw new Error('boom');
    })
  );
  app.use(errorHandler);
  return app;
}

describe('errorHandler + asyncHandler', () => {
  it('turns a thrown async error into a 500 json response', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = buildTestApp();

    const res = await request(app).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/errorHandler.test.ts`
Expected: FAIL — cannot find modules `../src/middleware/asyncHandler` and `../src/middleware/errorHandler`.

- [ ] **Step 3: Create `src/middleware/asyncHandler.ts`**

```typescript
import type { NextFunction, Request, RequestHandler, Response } from 'express';

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
```

- [ ] **Step 4: Create `src/middleware/errorHandler.ts`**

```typescript
import type { NextFunction, Request, Response } from 'express';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/errorHandler.test.ts`
Expected: PASS

- [ ] **Step 6: Wire `errorHandler` into the real app — modify `src/app.ts`**

```typescript
import express from 'express';
import { errorHandler } from './middleware/errorHandler';

export const app = express();

app.use(express.json());

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);
```

- [ ] **Step 7: Run the full test suite to confirm no regressions**

Run: `npx vitest run`
Expected: PASS (`app.test.ts`, `db.test.ts`, `errorHandler.test.ts` all green)

- [ ] **Step 8: Commit**

```bash
git add src/middleware/asyncHandler.ts src/middleware/errorHandler.ts src/app.ts tests/errorHandler.test.ts
git commit -m "feat: add asyncHandler + errorHandler middleware"
```

---

### Task 4: Create entry — `POST /entries`

**Files:**
- Create: `src/entries/entries.schema.ts`
- Create: `src/entries/entries.service.ts`
- Create: `src/entries/entries.routes.ts`
- Modify: `src/app.ts`
- Test: `tests/entries.create.test.ts`

**Interfaces:**
- Consumes: `prisma` from `../db` ([[Task 2]]); `asyncHandler` from `../middleware/asyncHandler` ([[Task 3]]).
- Produces: `createEntrySchema`, `updateEntrySchema`, `CreateEntryInput`, `UpdateEntryInput` from `entries.schema.ts`. `createEntry(input: CreateEntryInput)` and internal `shapeEntry(...)` from `entries.service.ts` — `shapeEntry` returns `{ id, placeName, neighborhood, city, visitedAt, createdAt, updatedAt, orderItems: string[], photoUrls: string[] }`, the exact response shape every entries endpoint returns. `entriesRouter` from `entries.routes.ts`, mounted at `/entries` in `app.ts`.

- [ ] **Step 1: Create `src/entries/entries.schema.ts`**

```typescript
import { z } from 'zod';

export const createEntrySchema = z.object({
  placeName: z.string().min(1),
  neighborhood: z.string().min(1),
  city: z.string().min(1),
  visitedAt: z.coerce.date().optional(),
  orderItems: z.array(z.string().min(1)).default([]),
});

export type CreateEntryInput = z.infer<typeof createEntrySchema>;

export const updateEntrySchema = createEntrySchema.partial();

export type UpdateEntryInput = z.infer<typeof updateEntrySchema>;
```

- [ ] **Step 2: Write the failing test**

```typescript
// tests/entries.create.test.ts
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../src/app';

describe('POST /entries', () => {
  it('creates an entry and returns it shaped for the client', async () => {
    const res = await request(app).post('/entries').send({
      placeName: 'Blue Bottle',
      neighborhood: 'Hayes Valley',
      city: 'San Francisco',
      orderItems: ['Oat milk latte', 'Croissant'],
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      placeName: 'Blue Bottle',
      neighborhood: 'Hayes Valley',
      city: 'San Francisco',
      orderItems: ['Oat milk latte', 'Croissant'],
      photoUrls: [],
    });
    expect(res.body.id).toEqual(expect.any(String));
  });

  it('rejects a body missing placeName', async () => {
    const res = await request(app).post('/entries').send({
      neighborhood: 'Hayes Valley',
      city: 'San Francisco',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid entry');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/entries.create.test.ts`
Expected: FAIL — `POST /entries` returns 404 (no such route yet).

- [ ] **Step 4: Create `src/entries/entries.service.ts`**

```typescript
import { prisma } from '../db';
import type { CreateEntryInput } from './entries.schema';

function shapeEntry(entry: {
  id: string;
  placeName: string;
  neighborhood: string;
  city: string;
  visitedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  orderItems: { name: string }[];
  photos: { filePath: string }[];
}) {
  return {
    id: entry.id,
    placeName: entry.placeName,
    neighborhood: entry.neighborhood,
    city: entry.city,
    visitedAt: entry.visitedAt,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    orderItems: entry.orderItems.map((item) => item.name),
    photoUrls: entry.photos.map((photo) => `/uploads/${photo.filePath}`),
  };
}

export async function createEntry(input: CreateEntryInput) {
  const entry = await prisma.journalEntry.create({
    data: {
      placeName: input.placeName,
      neighborhood: input.neighborhood,
      city: input.city,
      ...(input.visitedAt ? { visitedAt: input.visitedAt } : {}),
      orderItems: {
        create: input.orderItems.map((name) => ({ name })),
      },
    },
    include: { orderItems: true, photos: true },
  });

  return shapeEntry(entry);
}
```

- [ ] **Step 5: Create `src/entries/entries.routes.ts`**

```typescript
import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { createEntrySchema } from './entries.schema';
import { createEntry } from './entries.service';

export const entriesRouter = Router();

entriesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = createEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid entry', details: parsed.error.issues });
      return;
    }

    const entry = await createEntry(parsed.data);
    res.status(201).json(entry);
  })
);
```

- [ ] **Step 6: Mount the router — modify `src/app.ts`**

```typescript
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
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run tests/entries.create.test.ts`
Expected: PASS

- [ ] **Step 8: Run the full test suite to confirm no regressions**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/entries/entries.schema.ts src/entries/entries.service.ts src/entries/entries.routes.ts src/app.ts tests/entries.create.test.ts
git commit -m "feat: add POST /entries with zod validation"
```

---

### Task 5: List & get entries — `GET /entries`, `GET /entries/:id`

**Files:**
- Modify: `src/entries/entries.service.ts`
- Modify: `src/entries/entries.routes.ts`
- Test: `tests/entries.list-get.test.ts`

**Interfaces:**
- Consumes: `shapeEntry` (internal to `entries.service.ts`, [[Task 4]]); `entriesRouter` ([[Task 4]]).
- Produces: `listEntries()` → `Promise<ShapedEntry[]>` sorted by `visitedAt` descending; `getEntryById(id: string)` → `Promise<ShapedEntry | null>`. Both live in `entries.service.ts` and are used by [[Task 6]] and [[Task 7]] as the pattern for id-scoped lookups.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/entries.list-get.test.ts
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../src/app';

async function createEntry(overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/entries')
    .send({
      placeName: 'Blue Bottle',
      neighborhood: 'Hayes Valley',
      city: 'San Francisco',
      orderItems: [],
      ...overrides,
    });
  return res.body;
}

describe('GET /entries', () => {
  it('lists entries newest visitedAt first', async () => {
    const older = await createEntry({
      placeName: 'Older Cafe',
      visitedAt: '2026-01-01T00:00:00.000Z',
    });
    const newer = await createEntry({
      placeName: 'Newer Cafe',
      visitedAt: '2026-06-01T00:00:00.000Z',
    });

    const res = await request(app).get('/entries');

    expect(res.status).toBe(200);
    expect(res.body.map((e: { id: string }) => e.id)).toEqual([newer.id, older.id]);
  });
});

describe('GET /entries/:id', () => {
  it('returns a single entry', async () => {
    const created = await createEntry();

    const res = await request(app).get(`/entries/${created.id}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.id);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).get('/entries/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Entry not found' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/entries.list-get.test.ts`
Expected: FAIL — both routes return 404 (`GET /entries/:id` matched by nothing, `GET /entries` matched by nothing).

- [ ] **Step 3: Add `listEntries` and `getEntryById` — modify `src/entries/entries.service.ts`**

Add at the end of the file:

```typescript
export async function listEntries() {
  const entries = await prisma.journalEntry.findMany({
    include: { orderItems: true, photos: true },
    orderBy: { visitedAt: 'desc' },
  });
  return entries.map(shapeEntry);
}

export async function getEntryById(id: string) {
  const entry = await prisma.journalEntry.findUnique({
    where: { id },
    include: { orderItems: true, photos: true },
  });
  return entry ? shapeEntry(entry) : null;
}
```

- [ ] **Step 4: Add the routes — modify `src/entries/entries.routes.ts`**

```typescript
import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { createEntrySchema } from './entries.schema';
import { createEntry, getEntryById, listEntries } from './entries.service';

export const entriesRouter = Router();

entriesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const entries = await listEntries();
    res.json(entries);
  })
);

entriesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const entry = await getEntryById(req.params.id);
    if (!entry) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }
    res.json(entry);
  })
);

entriesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = createEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid entry', details: parsed.error.issues });
      return;
    }

    const entry = await createEntry(parsed.data);
    res.status(201).json(entry);
  })
);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/entries.list-get.test.ts`
Expected: PASS

- [ ] **Step 6: Run the full test suite to confirm no regressions**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/entries/entries.service.ts src/entries/entries.routes.ts tests/entries.list-get.test.ts
git commit -m "feat: add GET /entries and GET /entries/:id"
```

---

### Task 6: Update entry — `PATCH /entries/:id`

**Files:**
- Modify: `src/entries/entries.service.ts`
- Modify: `src/entries/entries.routes.ts`
- Test: `tests/entries.update.test.ts`

**Interfaces:**
- Consumes: `updateEntrySchema`, `UpdateEntryInput` ([[Task 4]]); `shapeEntry` (internal, [[Task 4]]).
- Produces: `updateEntry(id: string, input: UpdateEntryInput)` → `Promise<ShapedEntry | null>` in `entries.service.ts`, used as the not-found pattern by [[Task 7]].

- [ ] **Step 1: Write the failing test**

```typescript
// tests/entries.update.test.ts
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../src/app';

describe('PATCH /entries/:id', () => {
  it('updates only the fields provided', async () => {
    const created = await request(app).post('/entries').send({
      placeName: 'Blue Bottle',
      neighborhood: 'Hayes Valley',
      city: 'San Francisco',
      orderItems: ['Latte'],
    });

    const res = await request(app)
      .patch(`/entries/${created.body.id}`)
      .send({ placeName: 'Blue Bottle Coffee' });

    expect(res.status).toBe(200);
    expect(res.body.placeName).toBe('Blue Bottle Coffee');
    expect(res.body.neighborhood).toBe('Hayes Valley');
    expect(res.body.orderItems).toEqual(['Latte']);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).patch('/entries/does-not-exist').send({ placeName: 'X' });

    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/entries.update.test.ts`
Expected: FAIL — no `PATCH /entries/:id` route, returns 404 with body `{ error: 'Not found' }` from the catch-all instead of the expected shape (first assertion on `res.body.placeName` fails).

- [ ] **Step 3: Add `updateEntry` — modify `src/entries/entries.service.ts`**

Add at the end of the file (also add `UpdateEntryInput` to the existing import from `./entries.schema`):

```typescript
import type { CreateEntryInput, UpdateEntryInput } from './entries.schema';
```

```typescript
export async function updateEntry(id: string, input: UpdateEntryInput) {
  const existing = await prisma.journalEntry.findUnique({ where: { id } });
  if (!existing) return null;

  const entry = await prisma.journalEntry.update({
    where: { id },
    data: {
      ...(input.placeName !== undefined ? { placeName: input.placeName } : {}),
      ...(input.neighborhood !== undefined ? { neighborhood: input.neighborhood } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.visitedAt !== undefined ? { visitedAt: input.visitedAt } : {}),
      ...(input.orderItems !== undefined
        ? {
            orderItems: {
              deleteMany: {},
              create: input.orderItems.map((name) => ({ name })),
            },
          }
        : {}),
    },
    include: { orderItems: true, photos: true },
  });

  return shapeEntry(entry);
}
```

- [ ] **Step 4: Add the route — modify `src/entries/entries.routes.ts`**

Add the import and route:

```typescript
import { createEntrySchema, updateEntrySchema } from './entries.schema';
import { createEntry, getEntryById, listEntries, updateEntry } from './entries.service';
```

```typescript
entriesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const parsed = updateEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid entry', details: parsed.error.issues });
      return;
    }

    const entry = await updateEntry(req.params.id, parsed.data);
    if (!entry) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }
    res.json(entry);
  })
);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/entries.update.test.ts`
Expected: PASS

- [ ] **Step 6: Run the full test suite to confirm no regressions**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/entries/entries.service.ts src/entries/entries.routes.ts tests/entries.update.test.ts
git commit -m "feat: add PATCH /entries/:id"
```

---

### Task 7: Delete entry — `DELETE /entries/:id`

**Files:**
- Create: `src/uploads.ts`
- Modify: `src/entries/entries.service.ts`
- Modify: `src/entries/entries.routes.ts`
- Test: `tests/entries.delete.test.ts`

**Interfaces:**
- Consumes: `prisma` ([[Task 2]]).
- Produces: `uploadsDir` from `src/uploads.ts` — absolute path constant, consumed by [[Task 8]] and [[Task 9]] for multer's destination and `express.static`. `deleteEntry(id: string)` → `Promise<boolean>` in `entries.service.ts` — deletes the entry (cascading its `OrderItem`/`Photo` rows), then best-effort unlinks each photo's file from disk.

- [ ] **Step 1: Create `src/uploads.ts`**

```typescript
import path from 'node:path';

export const uploadsDir = path.join(process.cwd(), 'uploads');
```

- [ ] **Step 2: Write the failing test**

```typescript
// tests/entries.delete.test.ts
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../src/app';
import { prisma } from '../src/db';

describe('DELETE /entries/:id', () => {
  it('deletes the entry and its order items', async () => {
    const created = await request(app).post('/entries').send({
      placeName: 'Blue Bottle',
      neighborhood: 'Hayes Valley',
      city: 'San Francisco',
      orderItems: ['Latte'],
    });

    const res = await request(app).delete(`/entries/${created.body.id}`);
    expect(res.status).toBe(204);

    const found = await prisma.journalEntry.findUnique({ where: { id: created.body.id } });
    expect(found).toBeNull();

    const orphanOrderItems = await prisma.orderItem.findMany({
      where: { entryId: created.body.id },
    });
    expect(orphanOrderItems).toEqual([]);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).delete('/entries/does-not-exist');
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/entries.delete.test.ts`
Expected: FAIL — no `DELETE /entries/:id` route.

- [ ] **Step 4: Add `deleteEntry` — modify `src/entries/entries.service.ts`**

Add these imports at the top of the file:

```typescript
import fs from 'node:fs/promises';
import path from 'node:path';
import { uploadsDir } from '../uploads';
```

Add at the end of the file:

```typescript
export async function deleteEntry(id: string) {
  const existing = await prisma.journalEntry.findUnique({
    where: { id },
    include: { photos: true },
  });
  if (!existing) return false;

  await prisma.journalEntry.delete({ where: { id } });

  await Promise.all(
    existing.photos.map(async (photo) => {
      try {
        await fs.unlink(path.join(uploadsDir, photo.filePath));
      } catch (err) {
        console.warn(`Failed to remove photo file ${photo.filePath}`, err);
      }
    })
  );

  return true;
}
```

- [ ] **Step 5: Add the route — modify `src/entries/entries.routes.ts`**

Add `deleteEntry` to the import from `./entries.service`, then add:

```typescript
entriesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const deleted = await deleteEntry(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }
    res.status(204).send();
  })
);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/entries.delete.test.ts`
Expected: PASS

- [ ] **Step 7: Run the full test suite to confirm no regressions**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/uploads.ts src/entries/entries.service.ts src/entries/entries.routes.ts tests/entries.delete.test.ts
git commit -m "feat: add DELETE /entries/:id with photo file cleanup"
```

---

### Task 8: Upload photo — `POST /entries/:entryId/photos`

**Files:**
- Create: `src/photos/photos.service.ts`
- Create: `src/photos/photos.routes.ts`
- Modify: `src/app.ts`
- Modify: `tests/setup.ts`
- Test: `tests/photos.upload.test.ts`

**Interfaces:**
- Consumes: `prisma` ([[Task 2]]); `uploadsDir` ([[Task 7]]); `asyncHandler` ([[Task 3]]); `deleteEntry` ([[Task 7]], exercised transitively via the delete-cleanup test below).
- Produces: `upload` (a configured `multer` instance) and `addPhoto(entryId: string, filePath: string)` → `Promise<{ id: string; url: string } | null>` from `photos.service.ts`. `photosRouter` from `photos.routes.ts`, mounted at `/entries/:entryId/photos` in `app.ts`. `deletePhoto` in [[Task 9]] follows the same service pattern.

- [ ] **Step 1: Create `src/photos/photos.service.ts`**

```typescript
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { prisma } from '../db';
import { uploadsDir } from '../uploads';

fs.mkdirSync(uploadsDir, { recursive: true });

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error('Unsupported file type'));
      return;
    }
    cb(null, true);
  },
});

export async function addPhoto(entryId: string, filePath: string) {
  const entry = await prisma.journalEntry.findUnique({ where: { id: entryId } });
  if (!entry) return null;

  const photo = await prisma.photo.create({
    data: { entryId, filePath },
  });

  return { id: photo.id, url: `/uploads/${photo.filePath}` };
}
```

- [ ] **Step 2: Write the failing test**

```typescript
// tests/photos.upload.test.ts
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../src/app';

async function createEntry() {
  const res = await request(app).post('/entries').send({
    placeName: 'Blue Bottle',
    neighborhood: 'Hayes Valley',
    city: 'San Francisco',
    orderItems: [],
  });
  return res.body;
}

describe('POST /entries/:entryId/photos', () => {
  it('uploads a photo and serves it back from /uploads', async () => {
    const entry = await createEntry();

    const uploadRes = await request(app)
      .post(`/entries/${entry.id}/photos`)
      .attach('photo', Buffer.from([0xff, 0xd8, 0xff, 0xd9]), {
        filename: 'cafe.jpg',
        contentType: 'image/jpeg',
      });

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.url).toMatch(/^\/uploads\/.+\.jpg$/);

    const fileRes = await request(app).get(uploadRes.body.url);
    expect(fileRes.status).toBe(200);
  });

  it('rejects a non-image file', async () => {
    const entry = await createEntry();

    const res = await request(app)
      .post(`/entries/${entry.id}/photos`)
      .attach('photo', Buffer.from('not an image'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown entry', async () => {
    const res = await request(app)
      .post('/entries/does-not-exist/photos')
      .attach('photo', Buffer.from([0xff, 0xd8, 0xff, 0xd9]), {
        filename: 'cafe.jpg',
        contentType: 'image/jpeg',
      });

    expect(res.status).toBe(404);
  });

  it('deleting the entry also deletes the uploaded photo file', async () => {
    const entry = await createEntry();
    const uploadRes = await request(app)
      .post(`/entries/${entry.id}/photos`)
      .attach('photo', Buffer.from([0xff, 0xd8, 0xff, 0xd9]), {
        filename: 'cafe.jpg',
        contentType: 'image/jpeg',
      });

    await request(app).delete(`/entries/${entry.id}`);

    const fileRes = await request(app).get(uploadRes.body.url);
    expect(fileRes.status).toBe(404);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/photos.upload.test.ts`
Expected: FAIL — no `/entries/:entryId/photos` route.

- [ ] **Step 4: Create `src/photos/photos.routes.ts`**

```typescript
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
```

- [ ] **Step 5: Mount the router and static file serving — modify `src/app.ts`**

```typescript
import express from 'express';
import { entriesRouter } from './entries/entries.routes';
import { errorHandler } from './middleware/errorHandler';
import { photosRouter } from './photos/photos.routes';
import { uploadsDir } from './uploads';

export const app = express();

app.use(express.json());

app.use('/entries/:entryId/photos', photosRouter);
app.use('/entries', entriesRouter);
app.use('/uploads', express.static(uploadsDir));

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);
```

- [ ] **Step 6: Clean up uploaded files between tests — modify `tests/setup.ts`**

```typescript
import path from 'node:path';
import fs from 'node:fs/promises';
import { beforeEach, afterEach } from 'vitest';
import { prisma } from '../src/db';
import { uploadsDir } from '../src/uploads';

beforeEach(async () => {
  await prisma.photo.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.journalEntry.deleteMany();
});

afterEach(async () => {
  const files = await fs.readdir(uploadsDir).catch(() => [] as string[]);
  await Promise.all(files.map((file) => fs.unlink(path.join(uploadsDir, file))));
});
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run tests/photos.upload.test.ts`
Expected: PASS

- [ ] **Step 8: Run the full test suite to confirm no regressions**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/photos/photos.service.ts src/photos/photos.routes.ts src/app.ts tests/setup.ts tests/photos.upload.test.ts
git commit -m "feat: add POST /entries/:entryId/photos upload + static file serving"
```

---

### Task 9: Delete photo — `DELETE /entries/:entryId/photos/:photoId`

**Files:**
- Modify: `src/photos/photos.service.ts`
- Modify: `src/photos/photos.routes.ts`
- Test: `tests/photos.delete.test.ts`

**Interfaces:**
- Consumes: `prisma` ([[Task 2]]); `uploadsDir` ([[Task 7]]).
- Produces: `deletePhoto(entryId: string, photoId: string)` → `Promise<boolean>` in `photos.service.ts` — deletes the `Photo` row scoped to its parent entry, then best-effort unlinks the file.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/photos.delete.test.ts
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../src/app';

async function createEntryWithPhoto() {
  const entryRes = await request(app).post('/entries').send({
    placeName: 'Blue Bottle',
    neighborhood: 'Hayes Valley',
    city: 'San Francisco',
    orderItems: [],
  });
  const photoRes = await request(app)
    .post(`/entries/${entryRes.body.id}/photos`)
    .attach('photo', Buffer.from([0xff, 0xd8, 0xff, 0xd9]), {
      filename: 'cafe.jpg',
      contentType: 'image/jpeg',
    });
  return { entry: entryRes.body, photo: photoRes.body };
}

describe('DELETE /entries/:entryId/photos/:photoId', () => {
  it('deletes the photo row and its file', async () => {
    const { entry, photo } = await createEntryWithPhoto();

    const res = await request(app).delete(`/entries/${entry.id}/photos/${photo.id}`);
    expect(res.status).toBe(204);

    const fileRes = await request(app).get(photo.url);
    expect(fileRes.status).toBe(404);
  });

  it('returns 404 for an unknown photo id', async () => {
    const { entry } = await createEntryWithPhoto();

    const res = await request(app).delete(`/entries/${entry.id}/photos/does-not-exist`);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/photos.delete.test.ts`
Expected: FAIL — no `DELETE /entries/:entryId/photos/:photoId` route.

- [ ] **Step 3: Add `deletePhoto` — modify `src/photos/photos.service.ts`**

Add these imports at the top of the file:

```typescript
import { unlink } from 'node:fs/promises';
```

Add at the end of the file:

```typescript
export async function deletePhoto(entryId: string, photoId: string) {
  const photo = await prisma.photo.findFirst({ where: { id: photoId, entryId } });
  if (!photo) return false;

  await prisma.photo.delete({ where: { id: photo.id } });

  try {
    await unlink(path.join(uploadsDir, photo.filePath));
  } catch (err) {
    console.warn(`Failed to remove photo file ${photo.filePath}`, err);
  }

  return true;
}
```

- [ ] **Step 4: Add the route — modify `src/photos/photos.routes.ts`**

Add `deletePhoto` to the import from `./photos.service`, then add:

```typescript
photosRouter.delete(
  '/:photoId',
  asyncHandler(async (req, res) => {
    const deleted = await deletePhoto(req.params.entryId, req.params.photoId);
    if (!deleted) {
      res.status(404).json({ error: 'Photo not found' });
      return;
    }
    res.status(204).send();
  })
);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/photos.delete.test.ts`
Expected: PASS

- [ ] **Step 6: Run the full test suite to confirm no regressions**

Run: `npx vitest run`
Expected: PASS — all 9 tasks' tests green.

- [ ] **Step 7: Commit**

```bash
git add src/photos/photos.service.ts src/photos/photos.routes.ts tests/photos.delete.test.ts
git commit -m "feat: add DELETE /entries/:entryId/photos/:photoId"
```
