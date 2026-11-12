# Sightings Map — API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any signed-in user read sightings from every account inside a map area, read and add to their feeding logs, and report them, while editing and deleting stay with the registrant.

**Architecture:** One visibility rule (`visibleSightingWhere`) replaces the per-user filter on every sighting *read*; writes keep the existing `{ id, userId }` filter. `fed`/`fedAt` are derived at read time from today's feeding log entries. A new `SightingReport` table drives per-reporter hiding and a threshold-based `hiddenAt`.

**Tech Stack:** Express 4, Prisma 5 (SQLite), Zod 3, Vitest 2 + supertest.

**Spec:** `d:\Projects\journally\docs\superpowers\specs\2026-11-12-sightings-map-design.md` (section "API changes"). This plan is the first of two; the app plan is `d:\Projects\journally\docs\superpowers\plans\2026-11-12-sightings-map-app.md` and depends on this one.

## Global Constraints

- No response may contain a sighting's `userId`, a feeding entry's `userId`, or a report's `reporterId`.
- A sighting that exists but is not visible to the caller responds exactly like a missing one (404, or absent from a list).
- Registrant-only routes keep returning **404** (not 403) to other users: `PATCH /sightings/:id`, `DELETE /sightings/:id`, photo upload, photo delete.
- `GET /sightings` and `GET /sightings/nearby` stay own-only and keep their current behaviour.
- The migration must apply to a non-empty database: every new column is nullable or defaulted.
- Map result cap: **300**. Report hide threshold: env `REPORT_HIDE_THRESHOLD`, default **3**. `placeName` max **200** chars. Report `note` max **500** chars.
- Report reasons, exactly: `not_an_animal`, `inappropriate`, `private_info`, `spam`, `other`.
- Work on branch `feat/sightings-map`. **Do not commit per task**; the only commit is in Task 6 (owner's standing preference).
- The working tree already has unrelated changes (`pnpm-lock.yaml`, `pnpm-workspace.yaml`). Never stage them.

## Review Focus

Inputs the spec implies but doesn't spell out; each has a test in the task named.

1. Map bounds that are missing, non-numeric, inverted, or outside ±90/±180 → 400, never a 500 or an unbounded query. (Task 4)
2. A feeding entry from before today must not make `fed` true, even when the lazy purge has not run. (Task 2)
3. Reporting the same sighting twice → second call 200, still one row, even though the sighting is by then invisible to the reporter. (Task 5)
4. Report body with an unknown reason or a 501-char note → 400. (Task 5)
5. `placeName` that is whitespace-only → stored as null, not `""`. (Task 2)

## File Structure

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` + new migration | New columns, index, `SightingReport` |
| `src/shared/time.ts` (new) | `startOfToday()` — single definition of the feeding day |
| `src/sightings/visibility.ts` (new) | The visibility rule and `findVisibleSighting` |
| `src/sightings/sightings.service.ts` | Response shape, map query, visible get, `placeName` on create |
| `src/sightings/sightings.schema.ts` | `placeName`, map query schema, drop `fed` from update |
| `src/sightings/sightings.routes.ts` | `GET /map`, `POST /:id/report` |
| `src/reports/reports.schema.ts`, `src/reports/reports.service.ts` (new) | Report validation and behaviour |
| `src/feedings/feedings.service.ts` | Visibility instead of ownership; record `userId` |
| `tests/setup.ts` | Clean `sightingReport` between tests |
| `tests/sightings.map.test.ts`, `tests/sightings.report.test.ts` (new) | New endpoints |

---

### Task 1: Schema and migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_sightings_map/migration.sql` (generated)
- Modify: `tests/setup.ts`

**Interfaces:**
- Produces: Prisma models/fields used by every later task —
  `Sighting.placeName: String?`, `Sighting.hiddenAt: DateTime?`, `Sighting.reports: SightingReport[]`,
  `FeedingLogEntry.userId: String?`,
  `SightingReport { id, sightingId, reporterId, reason: String, note: String?, createdAt }` with `@@unique([sightingId, reporterId])`.

- [ ] **Step 1: Create the branch**

Run: `git checkout -b feat/sightings-map`

- [ ] **Step 2: Edit `prisma/schema.prisma`**

- `Sighting`: add `placeName String?`, `hiddenAt DateTime?`, `reports SightingReport[]`, and `@@index([lat, lng])`.
- `FeedingLogEntry`: add `userId String?` and `user User? @relation(fields: [userId], references: [id], onDelete: SetNull)`.
- `User`: add back-relations `feedingLogEntries FeedingLogEntry[]` and `sightingReports SightingReport[]`.
- New model:

```prisma
model SightingReport {
  id         String   @id @default(uuid())
  sightingId String
  sighting   Sighting @relation(fields: [sightingId], references: [id], onDelete: Cascade)
  reporterId String
  reporter   User     @relation(fields: [reporterId], references: [id], onDelete: Cascade)
  reason     String // validated in Zod
  note       String?
  createdAt  DateTime @default(now())

  @@unique([sightingId, reporterId])
}
```

- [ ] **Step 3: Generate the migration**

Run: `npx prisma migrate dev --name add_sightings_map`
Expected: a new folder under `prisma/migrations/`, "Your database is now in sync". If Prisma asks to reset the dev database, stop: a column was not made nullable.

- [ ] **Step 4: Clean reports between tests**

In `tests/setup.ts`, add `await prisma.sightingReport.deleteMany();` to the first `beforeEach`, before `prisma.feedingLogEntry.deleteMany()`.

- [ ] **Step 5: Verify nothing regressed**

Run: `npm test`
Expected: every existing test passes.

---

### Task 2: Response shape — `isMine`, `placeName`, derived `fed`

**Files:**
- Create: `src/shared/time.ts`
- Modify: `src/sightings/sightings.service.ts`, `src/sightings/sightings.schema.ts`, `src/sightings/sightings.routes.ts`, `src/feedings/feedings.service.ts` (import `startOfToday` from the shared file, delete the local copy)
- Test: `tests/sightings.create.test.ts`, `tests/sightings.update.test.ts`, `tests/sightings.list-get.test.ts`

**Interfaces:**
- Produces:
  - `startOfToday(): Date` in `src/shared/time.ts` (body moved unchanged from `feedings.service.ts`).
  - `sightingInclude()` in `sightings.service.ts` — the Prisma `include` every sighting read uses: `photos: true`, `attributes: true`, and `feedingLogEntries: { where: { createdAt: { gte: startOfToday() } }, orderBy: { createdAt: 'desc' }, take: 1 }`. It is a function, not a constant, so "today" is evaluated per request.
  - `shapeSighting(sighting, viewerId: string)` — exported; returns today's fields plus `isMine: sighting.userId === viewerId`, `placeName: sighting.placeName`, `fed: sighting.feedingLogEntries.length > 0`, `fedAt: sighting.feedingLogEntries[0]?.createdAt ?? null`. No `userId` key.
- Consumes: Task 1 columns.

- [ ] **Step 1: Write the failing tests**

Add to `tests/sightings.create.test.ts`:

```ts
it('stores a trimmed placeName and reports isMine', async () => {
  const res = await authedRequest(app)
    .post('/sightings')
    .send({ species: 'cat', lat: 0, lng: 0, placeName: '  Jl. Kemang Raya, Jakarta  ' });
  expect(res.status).toBe(201);
  expect(res.body.placeName).toBe('Jl. Kemang Raya, Jakarta');
  expect(res.body.isMine).toBe(true);
  expect(res.body).not.toHaveProperty('userId');
});

it('stores null for a missing or whitespace-only placeName', async () => {
  const none = await authedRequest(app).post('/sightings').send({ species: 'cat', lat: 0, lng: 0 });
  const blank = await authedRequest(app)
    .post('/sightings')
    .send({ species: 'cat', lat: 0, lng: 0, placeName: '   ' });
  expect(none.body.placeName).toBeNull();
  expect(blank.body.placeName).toBeNull();
});

it('rejects a placeName longer than 200 characters', async () => {
  const res = await authedRequest(app)
    .post('/sightings')
    .send({ species: 'cat', lat: 0, lng: 0, placeName: 'x'.repeat(201) });
  expect(res.status).toBe(400);
});
```

Add to `tests/sightings.list-get.test.ts` (import `prisma` from `../src/db`):

```ts
describe('derived fed status', () => {
  it('is true with fedAt once a feeding entry exists today', async () => {
    const created = await authedRequest(app).post('/sightings').send({ species: 'cat', lat: 0, lng: 0 });
    await authedRequest(app).post(`/sightings/${created.body.id}/feedings`).send({});
    const res = await authedRequest(app).get(`/sightings/${created.body.id}`);
    expect(res.body.fed).toBe(true);
    expect(res.body.fedAt).toEqual(expect.any(String));
  });

  it('ignores a feeding entry from before today', async () => {
    const created = await authedRequest(app).post('/sightings').send({ species: 'cat', lat: 0, lng: 0 });
    await prisma.feedingLogEntry.create({
      data: { sightingId: created.body.id, createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    });
    const res = await authedRequest(app).get(`/sightings/${created.body.id}`);
    expect(res.body.fed).toBe(false);
    expect(res.body.fedAt).toBeNull();
  });
});
```

In `tests/sightings.update.test.ts`, replace the two tests `'sets fedAt when fed is toggled to true'` and `'clears fedAt when fed is toggled back to false'` with:

```ts
it('ignores fed on PATCH; fed comes from the feeding log', async () => {
  const created = await authedRequest(app).post('/sightings').send({ species: 'cat', lat: 0, lng: 0 });
  const res = await authedRequest(app).patch(`/sightings/${created.body.id}`).send({ fed: true });
  expect(res.status).toBe(200);
  expect(res.body.fed).toBe(false);
  expect(res.body.fedAt).toBeNull();
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/sightings.create.test.ts tests/sightings.update.test.ts tests/sightings.list-get.test.ts`
Expected: the new tests fail (`placeName` undefined, `fed` false/true mismatches).

- [ ] **Step 3: Implement**

- `sightings.schema.ts`: add to `createSightingSchema`
  `placeName: z.string().trim().max(200).optional()`. Define `updateSightingSchema` as `createSightingSchema.partial()` (drop the `.extend({ fed })`; Zod strips the unknown key, so `PATCH { fed }` is silently ignored).
- `sightings.service.ts`: add `sightingInclude()`, change `shapeSighting` to the signature above, use both in every function. `createSighting` stores `placeName: input.placeName || null`. `updateSighting` no longer writes `fed`/`fedAt`. Every `shapeSighting(x)` call passes the `userId` already in scope.
- Leave the `fed`/`fedAt` columns in the schema; they are simply unused.

- [ ] **Step 4: Run to verify they pass**

Run: `npm test`
Expected: all pass.

---

### Task 3: Shared reads — sighting detail and feeding log

**Files:**
- Create: `src/sightings/visibility.ts`
- Modify: `src/sightings/sightings.service.ts` (`getSightingById`), `src/feedings/feedings.service.ts`
- Test: `tests/sightings.list-get.test.ts`, `tests/feedings.create.test.ts`, `tests/feedings.list.test.ts`

**Interfaces:**
- Produces, in `src/sightings/visibility.ts`:

```ts
import type { Prisma } from '@prisma/client';
import { prisma } from '../db';

/** Mine, or: not hidden and not reported by me. */
export function visibleSightingWhere(userId: string): Prisma.SightingWhereInput {
  return {
    OR: [{ userId }, { hiddenAt: null, reports: { none: { reporterId: userId } } }],
  };
}

/** The sighting if `userId` may see it, else null. Bare row, no relations. */
export function findVisibleSighting(userId: string, id: string) {
  return prisma.sighting.findFirst({ where: { AND: [{ id }, visibleSightingWhere(userId)] } });
}
```

- Consumes: `sightingInclude`, `shapeSighting` from Task 2.

- [ ] **Step 1: Write the failing tests**

In `tests/sightings.list-get.test.ts`, replace the `'GET /sightings/:id — ownership'` describe with:

```ts
describe('GET /sightings/:id — shared', () => {
  it("returns another user's sighting with isMine false and no userId", async () => {
    const created = await authedRequest(app).post('/sightings').send({ species: 'cat', lat: 0, lng: 0 });
    await createTestUser();
    const res = await authedRequest(app).get(`/sightings/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.isMine).toBe(false);
    expect(res.body).not.toHaveProperty('userId');
  });

  it("GET /sightings still lists only the caller's own", async () => {
    await authedRequest(app).post('/sightings').send({ species: 'cat', lat: 0, lng: 0 });
    await createTestUser();
    const res = await authedRequest(app).get('/sightings');
    expect(res.body).toEqual([]);
  });
});
```

In `tests/feedings.create.test.ts`, replace the `ownership` describe with:

```ts
describe('POST /sightings/:sightingId/feedings — shared', () => {
  it("lets another user add a feed, and marks the sighting fed for everyone", async () => {
    const sighting = await createSighting();
    const { user: feeder } = await createTestUser();
    const res = await authedRequest(app).post(`/sightings/${sighting.id}/feedings`).send({ note: 'Kibble' });
    expect(res.status).toBe(201);
    expect(res.body).not.toHaveProperty('userId');

    const row = await prisma.feedingLogEntry.findUnique({ where: { id: res.body.id } });
    expect(row?.userId).toBe(feeder.id);

    const seen = await authedRequest(app).get(`/sightings/${sighting.id}`);
    expect(seen.body.fed).toBe(true);
  });
});
```

In `tests/feedings.list.test.ts`, replace the `"returns 404 for another user's sighting"` test with one asserting a second user gets **200** and sees the entry the first user created.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/sightings.list-get.test.ts tests/feedings.create.test.ts tests/feedings.list.test.ts`
Expected: the three cross-user tests fail with 404.

- [ ] **Step 3: Implement**

- `getSightingById(userId, id)`: `where: { AND: [{ id }, visibleSightingWhere(userId)] }`, `include: sightingInclude()`.
- `feedings.service.ts`: both functions replace their `findFirst({ where: { id: sightingId, userId } })` with `findVisibleSighting(userId, sightingId)`. `createFeedingLogEntry` writes `userId` on the new row. `shapeFeedingLogEntry` is unchanged (it already omits `userId`).

- [ ] **Step 4: Run to verify they pass**

Run: `npm test`
Expected: all pass, including the untouched "404 for another user" tests for sighting update/delete and both photo routes.

---

### Task 4: `GET /sightings/map`

**Files:**
- Modify: `src/sightings/sightings.schema.ts`, `src/sightings/sightings.service.ts`, `src/sightings/sightings.routes.ts`
- Create: `tests/sightings.map.test.ts`

**Interfaces:**
- Produces:
  - `mapSightingQuerySchema` / `type MapSightingQuery = { south: number; west: number; north: number; east: number; species?: 'cat' | 'dog'; fed?: 'false' }`
  - `export const MAP_RESULT_LIMIT = 300` and `listSightingsInBounds(userId: string, query: MapSightingQuery)` in `sightings.service.ts`
  - `GET /sightings/map?south&west&north&east[&species][&fed=false]` → `200` array of shaped sightings.
- Consumes: `visibleSightingWhere`, `sightingInclude`, `shapeSighting`, `startOfToday`.

- [ ] **Step 1: Write the failing tests** in `tests/sightings.map.test.ts`

Use `authedRequest`, `createTestUser`, and `prisma` as the neighbouring test files do. `const box = { south: -1, west: -1, north: 1, east: 1 };`

```ts
it("returns sightings from every user inside the box, newest first, none outside", async () => {
  const byOther = await authedRequest(app).post('/sightings').send({ species: 'cat', lat: 0.1, lng: 0.1 });
  await authedRequest(app).post('/sightings').send({ species: 'cat', lat: 5, lng: 5 }); // outside
  await createTestUser(); // the caller from here on
  const byCaller = await authedRequest(app).post('/sightings').send({ species: 'dog', lat: -0.2, lng: 0.3 });

  const res = await authedRequest(app).get('/sightings/map').query(box);
  expect(res.status).toBe(200);
  expect(res.body.map((s: { id: string }) => s.id)).toEqual([byCaller.body.id, byOther.body.id]);
  expect(res.body[0].isMine).toBe(true);
  expect(res.body[1].isMine).toBe(false);
  for (const s of res.body) expect(s).not.toHaveProperty('userId');
});

it('filters by species', async () => { /* cat + dog in box, ?species=dog → only the dog */ });

it('fed=false returns only sightings with no feeding entry today', async () => {
  /* two sightings in box; POST a feed on one; ?fed=false → only the other */
});

it('caps the result at 300', async () => {
  const { user } = await createTestUser();
  await prisma.sighting.createMany({
    data: Array.from({ length: 301 }, () => ({ userId: user.id, species: 'cat', lat: 0, lng: 0 })),
  });
  const res = await authedRequest(app).get('/sightings/map').query(box);
  expect(res.body).toHaveLength(300);
});

it.each([
  ['missing east', { south: -1, west: -1, north: 1 }],
  ['non-numeric', { ...box, south: 'abc' }],
  ['south >= north', { ...box, south: 1, north: 1 }],
  ['west >= east', { ...box, west: 2, east: 1 }],
  ['latitude out of range', { ...box, south: -91 }],
  ['longitude out of range', { ...box, east: 181 }],
  ['bad species', { ...box, species: 'bird' }],
  ['bad fed value', { ...box, fed: 'true' }],
])('rejects %s with 400', async (_label, query) => {
  const res = await authedRequest(app).get('/sightings/map').query(query);
  expect(res.status).toBe(400);
});

it('requires auth', async () => {
  const res = await request(app).get('/sightings/map').query(box);
  expect(res.status).toBe(401);
});
```

Write the two commented tests out in full, in the same style.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/sightings.map.test.ts`
Expected: FAIL — `/sightings/map` is currently handled by `/:id` and returns 404.

- [ ] **Step 3: Implement**

- Schema: `z.coerce.number()` with `.min(-90).max(90)` for `south`/`north` and `.min(-180).max(180)` for `west`/`east`; `species: z.enum(['cat','dog']).optional()`; `fed: z.enum(['false']).optional()`; `.refine` that `south < north && west < east`.
- Service: `where: { AND: [visibleSightingWhere(userId), { lat: { gte: south, lte: north }, lng: { gte: west, lte: east } }, species filter, fed filter] }` where the fed filter is `{ feedingLogEntries: { none: { createdAt: { gte: startOfToday() } } } }`; `orderBy: { createdAt: 'desc' }`; `take: MAP_RESULT_LIMIT`; `include: sightingInclude()`.
- Route: register `GET /map` **above** `GET /:id`, next to `/nearby`; on a failed parse respond `400 { error: 'Invalid query', details }` like `/nearby`.

- [ ] **Step 4: Run to verify they pass**

Run: `npm test`
Expected: all pass.

---

### Task 5: Reporting and hiding

**Files:**
- Create: `src/reports/reports.schema.ts`, `src/reports/reports.service.ts`, `tests/sightings.report.test.ts`
- Modify: `src/sightings/sightings.routes.ts`, `.env.example`

**Interfaces:**
- Produces:
  - `reportSightingSchema` → `{ reason: 'not_an_animal' | 'inappropriate' | 'private_info' | 'spam' | 'other'; note?: string }` (`note`: trimmed, max 500).
  - `reportSighting(userId: string, sightingId: string, input): Promise<'created' | 'already_reported' | 'not_found' | 'own_sighting'>`
  - `POST /sightings/:id/report` → `201 { reported: true }` | `200 { reported: true }` (repeat) | `400` (own, or invalid body) | `404`.
- Consumes: `findVisibleSighting`, `visibleSightingWhere` (already applied by Tasks 3–4 to detail, feedings, and map).

- [ ] **Step 1: Write the failing tests** in `tests/sightings.report.test.ts`

Helper used below: a function that creates a sighting as the current user and returns its id, and `reportAs(token, id, body = { reason: 'spam' })` using `request(app).post(...).set(authHeader(token))`.

```ts
it('creates a report and hides the sighting from the reporter only', async () => {
  const id = await createSightingAsCurrentUser();           // owner = user A
  const reporter = await createTestUser();                    // user B
  const res = await reportAs(reporter.accessToken, id, { reason: 'inappropriate', note: 'not ok' });
  expect(res.status).toBe(201);
  expect(res.body).toEqual({ reported: true });

  const get = await request(app).get(`/sightings/${id}`).set(authHeader(reporter.accessToken));
  expect(get.status).toBe(404);
  const map = await request(app).get('/sightings/map').query(box).set(authHeader(reporter.accessToken));
  expect(map.body).toEqual([]);
  const feed = await request(app).post(`/sightings/${id}/feedings`).set(authHeader(reporter.accessToken)).send({});
  expect(feed.status).toBe(404);

  const bystander = await createTestUser();                   // user C still sees it
  const seen = await request(app).get(`/sightings/${id}`).set(authHeader(bystander.accessToken));
  expect(seen.status).toBe(200);
});

it('is idempotent: a second report returns 200 and leaves one row', async () => {
  /* report twice as B → 201 then 200; prisma.sightingReport.count({ where: { sightingId: id } }) === 1 */
});

it('rejects reporting your own sighting with 400', async () => { /* owner reports → 400, count 0 */ });

it('returns 404 for a sighting that does not exist', async () => { /* POST /sightings/nope/report → 404 */ });

it.each([
  ['unknown reason', { reason: 'boring' }],
  ['missing reason', {}],
  ['note over 500 chars', { reason: 'other', note: 'x'.repeat(501) }],
])('rejects %s with 400', async (_label, body) => { /* 400, count 0 */ });

it('hides the sighting from everyone but its registrant at 3 distinct reporters', async () => {
  const owner = await createTestUser();
  const id = /* create as owner */;
  for (let i = 0; i < 2; i++) await reportAs((await createTestUser()).accessToken, id);
  const bystander = await createTestUser();
  expect((await request(app).get(`/sightings/${id}`).set(authHeader(bystander.accessToken))).status).toBe(200);

  await reportAs((await createTestUser()).accessToken, id);   // third reporter
  expect((await request(app).get(`/sightings/${id}`).set(authHeader(bystander.accessToken))).status).toBe(404);
  expect((await request(app).get(`/sightings/${id}`).set(authHeader(owner.accessToken))).status).toBe(200);
  expect((await prisma.sighting.findUnique({ where: { id } }))?.hiddenAt).not.toBeNull();
});

it('honours REPORT_HIDE_THRESHOLD', async () => {
  /* set process.env.REPORT_HIDE_THRESHOLD = '1' (restore in finally); one report → hiddenAt set */
});

it('never returns reporterId', async () => { /* 201 body has only `reported` */ });
```

Write the commented tests out in full.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/sightings.report.test.ts`
Expected: FAIL with 404 (route missing).

- [ ] **Step 3: Implement `reportSighting`**

The order of checks is the part tests alone don't dictate:

```ts
export async function reportSighting(userId: string, sightingId: string, input: ReportSightingInput) {
  // First: a repeat report. The caller's own earlier report already made the
  // sighting invisible to them, so this must come before the visibility check.
  const existing = await prisma.sightingReport.findUnique({
    where: { sightingId_reporterId: { sightingId, reporterId: userId } },
  });
  if (existing) return 'already_reported' as const;

  const sighting = await findVisibleSighting(userId, sightingId);
  if (!sighting) return 'not_found' as const;
  if (sighting.userId === userId) return 'own_sighting' as const;

  await prisma.sightingReport.create({
    data: { sightingId, reporterId: userId, reason: input.reason, note: input.note || null },
  });

  const threshold = Number(process.env.REPORT_HIDE_THRESHOLD ?? 3);
  const reporters = await prisma.sightingReport.count({ where: { sightingId } });
  if (reporters >= threshold && sighting.hiddenAt === null) {
    await prisma.sighting.update({ where: { id: sightingId }, data: { hiddenAt: new Date() } });
  }
  return 'created' as const;
}
```

Read the env var inside the function, as shown, so the threshold test can change it.

- [ ] **Step 4: Add the route and document the env var**

`POST /:id/report` in `sightings.routes.ts`, mapping the four results to 201 / 200 / 404 `{ error: 'Sighting not found' }` / 400 `{ error: 'Cannot report your own sighting' }`; invalid body → `400 { error: 'Invalid report', details }`.
Append to `.env.example`: `# REPORT_HIDE_THRESHOLD=3`.

- [ ] **Step 5: Run to verify they pass**

Run: `npm test`
Expected: all pass.

---

### Task 6: Verify and commit

- [ ] **Step 1: Type-check and full suite**

Run: `npm run build && npm test`
Expected: `tsc` exits 0; every test passes.

- [ ] **Step 2: Confirm no identity leaks**

Run: `npx vitest run tests/sightings.map.test.ts tests/sightings.report.test.ts tests/feedings.create.test.ts tests/sightings.list-get.test.ts`
Expected: pass — these hold the `not.toHaveProperty('userId')` assertions.

- [ ] **Step 3: Commit (the only commit in this plan)**

```bash
git add prisma/schema.prisma prisma/migrations src tests .env.example docs/superpowers/plans/2026-11-12-sightings-map-api.md
git status --short   # pnpm-lock.yaml and pnpm-workspace.yaml must still be unstaged
git commit -m "feat: share sightings across users with map query, open feeding log, and reports"
```
