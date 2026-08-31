# AI Semantic Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user search journal entries with natural language via embedding-based semantic search — no per-query LLM call.

**Architecture:** Each entry's text (place/location/notes/order items) is embedded once on write and stored as a JSON-encoded float array in a new `EntryEmbedding` table. A search query is embedded once per search; results are ranked by cosine similarity computed in Node against all stored vectors (fine at low-hundreds scale — no vector DB).

**Tech Stack:** Same as existing backend (Node/Express/TypeScript/Prisma/SQLite/Zod/Vitest+Supertest), plus OpenAI's embeddings HTTP API (`text-embedding-3-small`) called via native `fetch` — no new SDK dependency.

**Spec:** `docs/superpowers/specs/2026-08-31-ai-semantic-search-design.md`

## Global Constraints

- No LLM reasoning call at query time — search is pure embed-and-compare, per spec's "Approach" section.
- Embedding generation runs inline (awaited) on entry create/update, not in a background queue.
- A failed embedding call must never fail the entry write — log and continue (`EmbeddingNotConfiguredError` and any other embedding error are both swallowed in the embeddings service).
- `OPENAI_API_KEY` is optional at the process level: its absence disables search (`503`) and skips embedding generation (logged warning), it does not crash the server.
- Cosine similarity threshold: `0.2` (from spec, filters unrelated noise out of results).
- Default search result limit: `20`.
- All new code follows existing feature-folder pattern (route file → service file → Prisma), Zod `.safeParse()` for input validation, `asyncHandler` wrapper on every route.
- TDD throughout: failing test → verify fail → implement → verify pass → commit.
- No real network calls in tests — every test that would call the embeddings API mocks `global.fetch`.

---

## File Structure

- `prisma/schema.prisma` — modify: add `notes` to `JournalEntry`, add `EntryEmbedding` model
- `src/entries/entries.schema.ts` — modify: add optional `notes` to create/update schemas
- `src/entries/entries.service.ts` — modify: `notes` passthrough, export `shapeEntry`, call embedding upsert after create/update
- `src/entries/entries.routes.ts` — modify: add `POST /:id/reembed`
- `src/embeddings/embeddings.client.ts` — create: `embedText()`, `EmbeddingNotConfiguredError`, `EMBEDDING_MODEL_NAME`
- `src/embeddings/embeddings.service.ts` — create: `buildEntryText()`, `upsertEmbeddingForEntry()`
- `src/embeddings/cosineSimilarity.ts` — create: `cosineSimilarity()`
- `src/search/search.service.ts` — create: `searchEntries()`
- `src/search/search.routes.ts` — create: `GET /`
- `src/app.ts` — modify: mount `searchRouter` at `/search`
- `vitest.config.ts` — modify: add `OPENAI_API_KEY: 'test-key'` to `test.env`
- `.env.example` / `.env` — modify: add `OPENAI_API_KEY=`
- Tests: `tests/entries.notes.test.ts`, `tests/embeddings.client.test.ts`, `tests/embeddings.service.test.ts`, `tests/cosineSimilarity.test.ts`, `tests/search.test.ts`, `tests/entries.reembed.test.ts` — create; `tests/setup.ts` — modify (clean `entryEmbedding` table)

---

### Task 1: Add `notes` field to journal entries

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/entries/entries.schema.ts`
- Modify: `src/entries/entries.service.ts`
- Test: `tests/entries.notes.test.ts`

**Interfaces:**
- Produces: `shapeEntry()` becomes exported from `src/entries/entries.service.ts` — later tasks (`search.service.ts`) import it directly rather than re-implementing entry shaping. Signature: `shapeEntry(entry: { id: string; placeName: string; neighborhood: string; city: string; visitedAt: Date; createdAt: Date; updatedAt: Date; lat: number | null; lng: number | null; placeId: string | null; notes: string | null; orderItems: { name: string; price: number | null }[]; photos: { filePath: string }[] }): { id, placeName, neighborhood, city, visitedAt, createdAt, updatedAt, lat, lng, placeId, notes, orderItems: {name, price}[], photoUrls: string[] }`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/entries.notes.test.ts
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from '../src/app';

describe('notes field', () => {
  it('stores and returns notes on create', async () => {
    const res = await request(app).post('/entries').send({
      placeName: 'Blue Bottle',
      neighborhood: 'Hayes Valley',
      city: 'San Francisco',
      orderItems: [],
      notes: 'Cozy spot, great oat milk latte',
    });

    expect(res.status).toBe(201);
    expect(res.body.notes).toBe('Cozy spot, great oat milk latte');
  });

  it('defaults notes to null when omitted', async () => {
    const res = await request(app).post('/entries').send({
      placeName: 'Blue Bottle',
      neighborhood: 'Hayes Valley',
      city: 'San Francisco',
      orderItems: [],
    });

    expect(res.status).toBe(201);
    expect(res.body.notes).toBeNull();
  });

  it('updates notes via PATCH', async () => {
    const created = await request(app).post('/entries').send({
      placeName: 'Blue Bottle',
      neighborhood: 'Hayes Valley',
      city: 'San Francisco',
      orderItems: [],
    });

    const res = await request(app)
      .patch(`/entries/${created.body.id}`)
      .send({ notes: 'Updated notes' });

    expect(res.status).toBe(200);
    expect(res.body.notes).toBe('Updated notes');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/entries.notes.test.ts`
Expected: FAIL — `notes` is `undefined` in the response (schema doesn't accept/return it yet).

- [ ] **Step 3: Add `notes` to the Prisma schema and migrate**

In `prisma/schema.prisma`, add to `JournalEntry`:

```prisma
  notes        String?
```

Run: `npx prisma migrate dev --name add_entry_notes`

- [ ] **Step 4: Accept `notes` in the Zod schemas**

In `src/entries/entries.schema.ts`, add to `createEntrySchema`:

```typescript
  notes: z.string().min(1).optional(),
```

(`updateEntrySchema` inherits it automatically via `.partial()`.)

- [ ] **Step 5: Pass `notes` through in the service and export `shapeEntry`**

In `src/entries/entries.service.ts`:

1. Change `function shapeEntry(` to `export function shapeEntry(`.
2. Add `notes: string | null;` to the `shapeEntry` parameter type, next to `placeId`.
3. Add `notes: entry.notes,` to the returned object, next to `placeId`.
4. In `createEntry`'s `data` object, add:
   ```typescript
   ...(input.notes !== undefined ? { notes: input.notes } : {}),
   ```
   (alongside the existing `lat`/`lng`/`placeId` conditionals).
5. In `updateEntry`'s `data` object, add the same conditional line.

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/entries.notes.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 7: Run full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all tests pass, no type errors

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/entries/entries.schema.ts src/entries/entries.service.ts tests/entries.notes.test.ts
git commit -m "feat: add optional notes field to journal entries"
```

---

### Task 2: Add `EntryEmbedding` model

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `prisma.entryEmbedding` client model with fields `id, entryId (unique), vector (String, JSON-encoded number[]), model (String), createdAt, updatedAt`. Later tasks (`embeddings.service.ts`, `search.service.ts`) read/write this table directly via `prisma.entryEmbedding`.

- [ ] **Step 1: Add the model to the schema**

In `prisma/schema.prisma`, add:

```prisma
model EntryEmbedding {
  id        String       @id @default(uuid())
  entryId   String       @unique
  entry     JournalEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)
  vector    String
  model     String
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt
}
```

Also add the inverse relation field to `JournalEntry`, alongside `orderItems`/`photos`:

```prisma
  embedding    EntryEmbedding?
```

- [ ] **Step 2: Run the migration**

Run: `npx prisma migrate dev --name add_entry_embedding`
Expected: migration created and applied, Prisma client regenerated.

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (no code references the new model yet, so nothing should break).

- [ ] **Step 4: Add cleanup to test setup**

In `tests/setup.ts`, add to the top of `beforeEach` (before `photo.deleteMany()`, since it has its own FK to `entryId` too):

```typescript
  await prisma.entryEmbedding.deleteMany();
```

- [ ] **Step 5: Run full suite**

Run: `npx vitest run`
Expected: all existing tests still pass (24 tests from prior work + 3 from Task 1 = 27 passing).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations tests/setup.ts
git commit -m "feat: add EntryEmbedding table"
```

---

### Task 3: Embeddings API client

**Files:**
- Create: `src/embeddings/embeddings.client.ts`
- Test: `tests/embeddings.client.test.ts`
- Modify: `.env.example`, `.env`
- Modify: `vitest.config.ts`

**Interfaces:**
- Produces: `embedText(text: string): Promise<number[]>` — calls OpenAI's embeddings endpoint, returns the embedding vector. Throws `EmbeddingNotConfiguredError` if `OPENAI_API_KEY` is unset. Throws a plain `Error` on a non-OK HTTP response. `EMBEDDING_MODEL_NAME` — exported constant string, used by `embeddings.service.ts` when writing the `model` column. Used by: `embeddings.service.ts` (Task 4), `search.service.ts` (Task 7), `search.routes.ts` (Task 8, to catch `EmbeddingNotConfiguredError` and respond 503).

- [ ] **Step 1: Add `OPENAI_API_KEY` to env files and test config**

In `.env.example`, add:
```
OPENAI_API_KEY=
```

In `.env`, add a placeholder (real key filled in manually, `.env` is gitignored):
```
OPENAI_API_KEY=
```

In `vitest.config.ts`, add to `test.env`:
```typescript
        OPENAI_API_KEY: 'test-key',
```

- [ ] **Step 2: Write the failing test**

```typescript
// tests/embeddings.client.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('embedText', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalKey;
    vi.resetModules();
  });

  it('returns the embedding vector from a successful response', async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2, 0.3] }] }), { status: 200 })
    ) as unknown as typeof fetch;

    const { embedText } = await import('../src/embeddings/embeddings.client');
    const vector = await embedText('a coffee shop');

    expect(vector).toEqual([0.1, 0.2, 0.3]);
  });

  it('throws EmbeddingNotConfiguredError when OPENAI_API_KEY is unset', async () => {
    delete process.env.OPENAI_API_KEY;
    vi.resetModules();
    const { embedText, EmbeddingNotConfiguredError } = await import(
      '../src/embeddings/embeddings.client'
    );

    await expect(embedText('a coffee shop')).rejects.toBeInstanceOf(EmbeddingNotConfiguredError);
  });

  it('throws when the API responds with a non-OK status', async () => {
    global.fetch = vi.fn(async () => new Response('rate limited', { status: 429 })) as unknown as typeof fetch;

    const { embedText } = await import('../src/embeddings/embeddings.client');

    await expect(embedText('a coffee shop')).rejects.toThrow('Embedding request failed: 429');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/embeddings.client.test.ts`
Expected: FAIL — `Cannot find module '../src/embeddings/embeddings.client'`

- [ ] **Step 4: Implement the client**

```typescript
// src/embeddings/embeddings.client.ts
export const EMBEDDING_MODEL_NAME = 'text-embedding-3-small';

export class EmbeddingNotConfiguredError extends Error {
  constructor() {
    super('OPENAI_API_KEY is not set');
    this.name = 'EmbeddingNotConfiguredError';
  }
}

export async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new EmbeddingNotConfiguredError();
  }

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL_NAME, input: text }),
  });

  if (!res.ok) {
    throw new Error(`Embedding request failed: ${res.status}`);
  }

  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data[0].embedding;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/embeddings.client.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Run full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass, no type errors

- [ ] **Step 7: Commit**

```bash
git add .env.example vitest.config.ts src/embeddings/embeddings.client.ts tests/embeddings.client.test.ts
git commit -m "feat: add OpenAI embeddings API client"
```

(Do not `git add .env` — it's gitignored; confirm with `git status` it isn't staged.)

---

### Task 4: Embeddings service (text building + upsert)

**Files:**
- Create: `src/embeddings/embeddings.service.ts`
- Test: `tests/embeddings.service.test.ts`

**Interfaces:**
- Consumes: `embedText` from `src/embeddings/embeddings.client.ts` (Task 3); `prisma` from `src/db.ts`.
- Produces: `buildEntryText(entry): string`, `upsertEmbeddingForEntry(entryId: string): Promise<void>` — never throws (all errors caught and logged internally). Used by `entries.service.ts` (Task 5) and `entries.routes.ts` (Task 9, reembed endpoint).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/embeddings.service.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/db';
import { buildEntryText, upsertEmbeddingForEntry } from '../src/embeddings/embeddings.service';

describe('buildEntryText', () => {
  it('combines place, location, notes, and order item names', () => {
    const text = buildEntryText({
      placeName: 'Blue Bottle',
      neighborhood: 'Hayes Valley',
      city: 'San Francisco',
      notes: 'Cozy spot',
      orderItems: [{ name: 'Latte' }, { name: 'Croissant' }],
    });

    expect(text).toBe(
      'Blue Bottle. Hayes Valley, San Francisco. Cozy spot. Ordered: Latte, Croissant.'
    );
  });

  it('handles null notes and empty order items', () => {
    const text = buildEntryText({
      placeName: 'Blue Bottle',
      neighborhood: 'Hayes Valley',
      city: 'San Francisco',
      notes: null,
      orderItems: [],
    });

    expect(text).toBe('Blue Bottle. Hayes Valley, San Francisco. . Ordered: .');
  });
});

describe('upsertEmbeddingForEntry', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('creates an EntryEmbedding row for an existing entry', async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2, 0.3] }] }), { status: 200 })
    ) as unknown as typeof fetch;

    const entry = await prisma.journalEntry.create({
      data: { placeName: 'Blue Bottle', neighborhood: 'Hayes Valley', city: 'San Francisco' },
    });

    await upsertEmbeddingForEntry(entry.id);

    const embedding = await prisma.entryEmbedding.findUnique({ where: { entryId: entry.id } });
    expect(embedding).not.toBeNull();
    expect(JSON.parse(embedding!.vector)).toEqual([0.1, 0.2, 0.3]);
  });

  it('does nothing for a non-existent entry', async () => {
    await expect(upsertEmbeddingForEntry('does-not-exist')).resolves.toBeUndefined();
  });

  it('does not throw when the embedding API call fails', async () => {
    global.fetch = vi.fn(async () => new Response('error', { status: 500 })) as unknown as typeof fetch;

    const entry = await prisma.journalEntry.create({
      data: { placeName: 'Blue Bottle', neighborhood: 'Hayes Valley', city: 'San Francisco' },
    });

    await expect(upsertEmbeddingForEntry(entry.id)).resolves.toBeUndefined();

    const embedding = await prisma.entryEmbedding.findUnique({ where: { entryId: entry.id } });
    expect(embedding).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/embeddings.service.test.ts`
Expected: FAIL — `Cannot find module '../src/embeddings/embeddings.service'`

- [ ] **Step 3: Implement the service**

```typescript
// src/embeddings/embeddings.service.ts
import { prisma } from '../db';
import { EMBEDDING_MODEL_NAME, EmbeddingNotConfiguredError, embedText } from './embeddings.client';

export function buildEntryText(entry: {
  placeName: string;
  neighborhood: string;
  city: string;
  notes: string | null;
  orderItems: { name: string }[];
}): string {
  const itemNames = entry.orderItems.map((item) => item.name).join(', ');
  return `${entry.placeName}. ${entry.neighborhood}, ${entry.city}. ${entry.notes ?? ''}. Ordered: ${itemNames}.`;
}

export async function upsertEmbeddingForEntry(entryId: string): Promise<void> {
  const entry = await prisma.journalEntry.findUnique({
    where: { id: entryId },
    include: { orderItems: true },
  });
  if (!entry) return;

  try {
    const text = buildEntryText(entry);
    const vector = await embedText(text);
    await prisma.entryEmbedding.upsert({
      where: { entryId },
      create: { entryId, vector: JSON.stringify(vector), model: EMBEDDING_MODEL_NAME },
      update: { vector: JSON.stringify(vector), model: EMBEDDING_MODEL_NAME },
    });
  } catch (err) {
    if (err instanceof EmbeddingNotConfiguredError) {
      console.warn('Skipping embedding: OPENAI_API_KEY not set');
      return;
    }
    console.warn(`Failed to embed entry ${entryId}`, err);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/embeddings.service.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Run full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass, no type errors

- [ ] **Step 6: Commit**

```bash
git add src/embeddings/embeddings.service.ts tests/embeddings.service.test.ts
git commit -m "feat: add embeddings service (text building + upsert)"
```

---

### Task 5: Wire embedding generation into entry create/update

**Files:**
- Modify: `src/entries/entries.service.ts`
- Test: `tests/entries.notes.test.ts` (extend) or new assertions inline in existing create/update tests

**Interfaces:**
- Consumes: `upsertEmbeddingForEntry` from `src/embeddings/embeddings.service.ts` (Task 4).

- [ ] **Step 1: Write the failing test**

Append to `tests/entries.notes.test.ts`:

```typescript
import { vi } from 'vitest';
import { prisma } from '../src/db';

describe('embedding generation on write', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('creates an embedding when an entry is created', async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2, 0.3] }] }), { status: 200 })
    ) as unknown as typeof fetch;

    const res = await request(app).post('/entries').send({
      placeName: 'Blue Bottle',
      neighborhood: 'Hayes Valley',
      city: 'San Francisco',
      orderItems: [],
    });

    const embedding = await prisma.entryEmbedding.findUnique({ where: { entryId: res.body.id } });
    expect(embedding).not.toBeNull();
  });

  it('re-embeds when an entry is updated', async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ data: [{ embedding: [0.4, 0.5, 0.6] }] }), { status: 200 })
    ) as unknown as typeof fetch;

    const created = await request(app).post('/entries').send({
      placeName: 'Blue Bottle',
      neighborhood: 'Hayes Valley',
      city: 'San Francisco',
      orderItems: [],
    });

    await request(app).patch(`/entries/${created.body.id}`).send({ notes: 'Updated' });

    const embedding = await prisma.entryEmbedding.findUnique({
      where: { entryId: created.body.id },
    });
    expect(JSON.parse(embedding!.vector)).toEqual([0.4, 0.5, 0.6]);
  });
});
```

(Add `import { afterEach } from 'vitest';` to the existing import line if not already present, and add `vi` to it too.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/entries.notes.test.ts`
Expected: FAIL — no `EntryEmbedding` row created (nothing calls `upsertEmbeddingForEntry` yet).

- [ ] **Step 3: Wire it into the service**

In `src/entries/entries.service.ts`, add the import:

```typescript
import { upsertEmbeddingForEntry } from '../embeddings/embeddings.service';
```

In `createEntry`, change the ending from:
```typescript
  return shapeEntry(entry);
}
```
to:
```typescript
  await upsertEmbeddingForEntry(entry.id);
  return shapeEntry(entry);
}
```

Do the same in `updateEntry` (its own `return shapeEntry(entry);` line at the end of the function).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/entries.notes.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Run full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass, no type errors

- [ ] **Step 6: Commit**

```bash
git add src/entries/entries.service.ts tests/entries.notes.test.ts
git commit -m "feat: generate embeddings on entry create/update"
```

---

### Task 6: Cosine similarity utility

**Files:**
- Create: `src/embeddings/cosineSimilarity.ts`
- Test: `tests/cosineSimilarity.test.ts`

**Interfaces:**
- Produces: `cosineSimilarity(a: number[], b: number[]): number` — returns a value in `[-1, 1]`, `0` if either vector is all-zero. Used by `search.service.ts` (Task 7).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/cosineSimilarity.test.ts
import { describe, expect, it } from 'vitest';
import { cosineSimilarity } from '../src/embeddings/cosineSimilarity';

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBe(1);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBe(-1);
  });

  it('returns 0 when a vector is all zeros', () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cosineSimilarity.test.ts`
Expected: FAIL — `Cannot find module '../src/embeddings/cosineSimilarity'`

- [ ] **Step 3: Implement it**

```typescript
// src/embeddings/cosineSimilarity.ts
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/cosineSimilarity.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/embeddings/cosineSimilarity.ts tests/cosineSimilarity.test.ts
git commit -m "feat: add cosine similarity utility"
```

---

### Task 7: Search service

**Files:**
- Create: `src/search/search.service.ts`
- Test: `tests/search.test.ts` (service-level tests; route tests come in Task 8)

**Interfaces:**
- Consumes: `embedText` (Task 3), `cosineSimilarity` (Task 6), `shapeEntry` (Task 1, now exported from `entries.service.ts`), `prisma`.
- Produces: `searchEntries(query: string, limit?: number): Promise<ReturnType<typeof shapeEntry>[]>`. Used by `search.routes.ts` (Task 8).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/search.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/db';
import { searchEntries } from '../src/search/search.service';

function mockEmbeddingResponses(vectorsByInputSubstring: Record<string, number[]>) {
  global.fetch = vi.fn(async (_url, options) => {
    const body = JSON.parse((options as RequestInit).body as string) as { input: string };
    const match = Object.keys(vectorsByInputSubstring).find((key) => body.input.includes(key));
    const vector = match ? vectorsByInputSubstring[match] : [0, 0, 1];
    return new Response(JSON.stringify({ data: [{ embedding: vector }] }), { status: 200 });
  }) as unknown as typeof fetch;
}

async function createEntryWithEmbedding(placeName: string, vector: number[]) {
  mockEmbeddingResponses({ [placeName]: vector });
  const entry = await prisma.journalEntry.create({
    data: { placeName, neighborhood: 'Hayes Valley', city: 'San Francisco' },
  });
  await prisma.entryEmbedding.create({
    data: { entryId: entry.id, vector: JSON.stringify(vector), model: 'test-model' },
  });
  return entry;
}

describe('searchEntries', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('ranks entries by similarity to the query, closest first', async () => {
    const blueBottle = await createEntryWithEmbedding('Blue Bottle', [1, 0, 0]);
    await createEntryWithEmbedding('Ritual Coffee', [0, 1, 0]);

    mockEmbeddingResponses({ query: [1, 0, 0] });
    const results = await searchEntries('query for blue bottle-like coffee');

    expect(results[0].id).toBe(blueBottle.id);
  });

  it('excludes entries below the similarity threshold', async () => {
    await createEntryWithEmbedding('Ritual Coffee', [0, 1, 0]);

    mockEmbeddingResponses({ query: [1, 0, 0] });
    const results = await searchEntries('query for blue bottle-like coffee');

    expect(results).toEqual([]);
  });

  it('excludes entries with no embedding row', async () => {
    await prisma.journalEntry.create({
      data: { placeName: 'No Embedding Cafe', neighborhood: 'Mission', city: 'San Francisco' },
    });

    mockEmbeddingResponses({ query: [1, 0, 0] });
    const results = await searchEntries('query');

    expect(results).toEqual([]);
  });

  it('respects the limit parameter', async () => {
    await createEntryWithEmbedding('Cafe A', [1, 0, 0]);
    await createEntryWithEmbedding('Cafe B', [0.9, 0.1, 0]);
    await createEntryWithEmbedding('Cafe C', [0.8, 0.2, 0]);

    mockEmbeddingResponses({ query: [1, 0, 0] });
    const results = await searchEntries('query', 2);

    expect(results.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/search.test.ts`
Expected: FAIL — `Cannot find module '../src/search/search.service'`

- [ ] **Step 3: Implement the search service**

```typescript
// src/search/search.service.ts
import { shapeEntry } from '../entries/entries.service';
import { embedText } from '../embeddings/embeddings.client';
import { cosineSimilarity } from '../embeddings/cosineSimilarity';
import { prisma } from '../db';

const SIMILARITY_THRESHOLD = 0.2;
const DEFAULT_LIMIT = 20;

export async function searchEntries(query: string, limit: number = DEFAULT_LIMIT) {
  const queryVector = await embedText(query);

  const embeddings = await prisma.entryEmbedding.findMany({
    include: { entry: { include: { orderItems: true, photos: true } } },
  });

  return embeddings
    .map((row) => ({
      entry: shapeEntry(row.entry),
      similarity: cosineSimilarity(queryVector, JSON.parse(row.vector) as number[]),
    }))
    .filter((result) => result.similarity >= SIMILARITY_THRESHOLD)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
    .map((result) => result.entry);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/search.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Run full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass, no type errors

- [ ] **Step 6: Commit**

```bash
git add src/search/search.service.ts tests/search.test.ts
git commit -m "feat: add search service (embed + cosine rank)"
```

---

### Task 8: Search route

**Files:**
- Create: `src/search/search.routes.ts`
- Modify: `src/app.ts`
- Test: `tests/search.test.ts` (extend with HTTP-level tests)

**Interfaces:**
- Consumes: `searchEntries` (Task 7), `EmbeddingNotConfiguredError` (Task 3), `asyncHandler`.
- Produces: `searchRouter` (Express `Router`), mounted at `/search` in `src/app.ts`.

- [ ] **Step 1: Write the failing test**

Append to `tests/search.test.ts`:

```typescript
import request from 'supertest';
import { app } from '../src/app';

describe('GET /search', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalKey;
  });

  it('returns ranked entries for a query', async () => {
    const blueBottle = await createEntryWithEmbedding('Blue Bottle', [1, 0, 0]);
    mockEmbeddingResponses({ query: [1, 0, 0] });

    const res = await request(app).get('/search').query({ q: 'query for blue bottle' });

    expect(res.status).toBe(200);
    expect(res.body[0].id).toBe(blueBottle.id);
  });

  it('returns 400 when q is missing', async () => {
    const res = await request(app).get('/search');
    expect(res.status).toBe(400);
  });

  it('returns 503 when OPENAI_API_KEY is not configured', async () => {
    delete process.env.OPENAI_API_KEY;

    const res = await request(app).get('/search').query({ q: 'anything' });

    expect(res.status).toBe(503);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/search.test.ts`
Expected: FAIL — `GET /search` returns 404 (route doesn't exist yet).

- [ ] **Step 3: Implement the route**

```typescript
// src/search/search.routes.ts
import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { EmbeddingNotConfiguredError } from '../embeddings/embeddings.client';
import { searchEntries } from './search.service';

export const searchRouter = Router();

searchRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q) {
      res.status(400).json({ error: 'q is required' });
      return;
    }

    const limit = req.query.limit ? Number(req.query.limit) : undefined;

    try {
      const results = await searchEntries(q, limit);
      res.json(results);
    } catch (err) {
      if (err instanceof EmbeddingNotConfiguredError) {
        res.status(503).json({ error: 'Search not configured' });
        return;
      }
      throw err;
    }
  })
);
```

Note: passing `limit: undefined` to `searchEntries` is safe — the function's default parameter (`= DEFAULT_LIMIT`) only applies when the argument is `undefined`.

- [ ] **Step 4: Mount the router**

In `src/app.ts`, add the import:

```typescript
import { searchRouter } from './search/search.routes';
```

And mount it before the 404 handler (order matters — after `/entries` and `/uploads`, before the catch-all):

```typescript
app.use('/search', searchRouter);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/search.test.ts`
Expected: PASS (7 tests total in the file)

- [ ] **Step 6: Run full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass, no type errors

- [ ] **Step 7: Commit**

```bash
git add src/search/search.routes.ts src/app.ts tests/search.test.ts
git commit -m "feat: add GET /search endpoint"
```

---

### Task 9: Reembed endpoint (backfill/maintenance)

**Files:**
- Modify: `src/entries/entries.routes.ts`
- Test: `tests/entries.reembed.test.ts`

**Interfaces:**
- Consumes: `upsertEmbeddingForEntry` (Task 4), `getEntryById` (existing, from `entries.service.ts`).
- Produces: `POST /entries/:id/reembed` — `204` on success, `404` if the entry doesn't exist.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/entries.reembed.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/db';

describe('POST /entries/:id/reembed', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('regenerates the embedding for an existing entry', async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ data: [{ embedding: [0.7, 0.8, 0.9] }] }), { status: 200 })
    ) as unknown as typeof fetch;

    const created = await request(app).post('/entries').send({
      placeName: 'Blue Bottle',
      neighborhood: 'Hayes Valley',
      city: 'San Francisco',
      orderItems: [],
    });

    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2, 0.3] }] }), { status: 200 })
    ) as unknown as typeof fetch;

    const res = await request(app).post(`/entries/${created.body.id}/reembed`);
    expect(res.status).toBe(204);

    const embedding = await prisma.entryEmbedding.findUnique({
      where: { entryId: created.body.id },
    });
    expect(JSON.parse(embedding!.vector)).toEqual([0.1, 0.2, 0.3]);
  });

  it('returns 404 for an unknown entry', async () => {
    const res = await request(app).post('/entries/does-not-exist/reembed');
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/entries.reembed.test.ts`
Expected: FAIL — 404 on a route that should return 204 (route doesn't exist yet).

- [ ] **Step 3: Implement the route**

In `src/entries/entries.routes.ts`, add the import:

```typescript
import { upsertEmbeddingForEntry } from '../embeddings/embeddings.service';
```

Add the route (after the existing `DELETE /:id` route):

```typescript
entriesRouter.post(
  '/:id/reembed',
  asyncHandler(async (req, res) => {
    const entry = await getEntryById(req.params.id);
    if (!entry) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }

    await upsertEmbeddingForEntry(req.params.id);
    res.status(204).send();
  })
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/entries.reembed.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Run full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass, no type errors

- [ ] **Step 6: Commit**

```bash
git add src/entries/entries.routes.ts tests/entries.reembed.test.ts
git commit -m "feat: add POST /entries/:id/reembed for backfill and re-indexing"
```

---

## Final Verification

After all 9 tasks:

```bash
npx vitest run
npx tsc --noEmit
npm run build
```

Expected: full suite green (~45 tests), clean typecheck, clean build. Manual smoke test requires a real `OPENAI_API_KEY` in `.env` — run the dev server, `POST /entries` with `notes`, then `GET /search?q=...` and confirm it returns the entry.
