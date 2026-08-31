# Journally Backend — Design Spec

Date: 2026-08-31
Status: Approved, ready for implementation plan

## Purpose

Backend API for Journally, a personal Flutter journal app for cafe visits.
Single user, no auth. Replaces the app's current `MockJournalRepository`
(hardcoded data) with a real Node.js + Express + TypeScript + SQLite
(via Prisma) API supporting full CRUD on journal entries and photo upload.

## Context: existing Flutter client model

`lib/features/home/domain/journal_entry.dart`:

```dart
class JournalEntry {
  final String id;
  final String placeName;
  final String neighborhood;
  final String city;
  final List<String> orderItems;
  final int photoCount;
  final List<Color> gradientColors; // UI-only placeholder, client-side
}
```

`gradientColors` is a client-side-only placeholder gradient invented for a
UI mockup phase before any backend existed — it is **not** replicated in
the API or DB schema. The API returns `photoUrls: string[]`; the Flutter
app computes/keeps its own placeholder gradient client-side for entries
with zero photos (client-side change, out of scope for this backend spec).

The client currently only has a read-only list screen
(`JournalRepository.fetchEntries()` → `Future<List<JournalEntry>>`). No
create/edit UI exists yet, but the backend supports full CRUD from the
start since that UI is coming.

## Data model (Prisma schema)

```prisma
model JournalEntry {
  id            String      @id @default(uuid())
  placeName     String
  neighborhood  String
  city          String
  visitedAt     DateTime    @default(now())
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  orderItems    OrderItem[]
  photos        Photo[]
}

model OrderItem {
  id        String       @id @default(uuid())
  name      String
  entryId   String
  entry     JournalEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)
}

model Photo {
  id        String       @id @default(uuid())
  filePath  String       // filename only (e.g. "a1b2c3.jpg"), not full path
  entryId   String
  entry     JournalEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)
  createdAt DateTime     @default(now())
}
```

Notes:
- All ids are UUID strings — matches the Flutter model's `id: String`
  already, no int/string conversion layer needed.
- `orderItems` and `photos` are separate tables (not JSON columns).
  OrderItem rows are internal — the API never exposes OrderItem ids to
  clients, just `orderItems: string[]` in and out.
- `visitedAt` (when the cafe visit happened, user-editable, defaults to
  now on create) is distinct from `createdAt`/`updatedAt` (server-managed
  record audit timestamps). The current Flutter model has no date field
  at all; `visitedAt` is new but expected — journal entries are inherently
  dated events.
- `onDelete: Cascade` drops child rows in the DB when an entry is
  deleted. It does **not** touch files on disk — photo file cleanup is
  the delete handler's job (see Photo storage below).

## Endpoints

```
GET    /entries              list all, newest visitedAt first, each with orderItems + photoUrls
GET    /entries/:id          single entry detail
POST   /entries              create (placeName, neighborhood, city, visitedAt?, orderItems: string[])
PATCH  /entries/:id          partial update, same fields all optional
DELETE /entries/:id          delete entry + cascade rows + delete its photo files off disk

POST   /entries/:id/photos          multipart upload, one file field, returns created Photo (id + url)
DELETE /entries/:id/photos/:photoId delete one photo — row + file off disk

GET    /uploads/:filename    static file serve (photo bytes)
```

`PATCH` (not `PUT`) for updates — the edit screen sends only changed
fields, no need to resend the whole entry.

`photoUrls` on an entry response is computed per-request as
`/uploads/<filePath>` for each of the entry's Photo rows — not stored
redundantly. The Photo table is the single source of truth.

## Photo storage

- Files live in `/uploads` at repo root, gitignored (real user photos,
  not source-controlled).
- Upload handled by `multer`, disk storage engine, filename generated as
  `${uuid()}.${ext}` — original filename discarded to avoid collisions
  and path-injection.
- Accept image mimetypes only (jpg/png/webp); reject others with `400`.
  Size cap ~10MB (typical phone photo).
- Static file serving via `express.static('uploads')` mounted at
  `/uploads`.
- Photo delete: delete the DB row first, then attempt to unlink the file;
  if unlink fails, log a warning but don't fail the request — an orphan
  file on disk is harmless, an orphan DB row pointing at a missing file
  is worse.
- Entry delete: fetch the entry's photos first (need filenames) before
  the cascade delete removes the rows, then loop-unlink each file after
  the DB delete succeeds.

## Project layout

Feature-folder, thin — one folder per resource (entries, photos), route
files talk directly to Prisma via a small service module, no separate
controller layer. Chosen over classic layered (routes/controllers/
services/ as three top-level folders) because with only two resources,
a controller indirection layer adds hops to trace a request without
payoff. Feature folders also keep related code physically together,
which is easier to learn from.

```
src/
  app.ts                 # express app setup, middleware, mount routes
  server.ts              # listen()
  db.ts                  # prisma client singleton
  entries/
    entries.routes.ts    # GET/POST/PATCH/DELETE /entries
    entries.service.ts   # prisma calls + orderItems/photoUrls shaping
    entries.schema.ts    # zod schemas for create/update body
  photos/
    photos.routes.ts     # POST/DELETE /entries/:id/photos
    photos.service.ts    # multer config, disk unlink, prisma calls
  middleware/
    errorHandler.ts      # catches thrown errors -> json {error} + status
    asyncHandler.ts       # wraps async route handlers, forwards rejected promises to next()
uploads/                  # gitignored, photo files land here
prisma/
  schema.prisma
```

`entries.service.ts` is responsible for response shaping: joining Photo
rows into `photoUrls: string[]` and OrderItem rows into `orderItems:
string[]`, dropping the raw child-table ids from what the client sees.

## Error handling & validation

- Every write endpoint (`POST`/`PATCH`) validates its body with a Zod
  schema (`entries.schema.ts`) via `.safeParse()`. Validation failure →
  `400 { error: "...", details: [...] }`.
- Lookup by id that doesn't exist (`GET`/`PATCH`/`DELETE /entries/:id`,
  photo routes) → `404 { error: "Entry not found" }` (or `"Photo not
  found"`).
- Anything unexpected (Prisma errors, disk I/O errors) is thrown and
  caught by a single `errorHandler` middleware mounted last in
  `app.ts` → `500 { error: "Internal server error" }`. The real error is
  logged server-side only, never leaked to the client response.
- Route handlers are wrapped in a small `asyncHandler` utility so
  rejected promises reach `errorHandler` via `next(err)` automatically,
  instead of repeating `try/catch` in every route.

## Testing & tooling

- Test runner: `vitest` (TS-native, no extra config) + `supertest` for
  HTTP-level route tests.
- Tests run against a separate SQLite file (`test.db`), not the dev
  `dev.db`, reset via Prisma migrate between runs.
- Coverage target: one happy-path + one error-path test per endpoint —
  enough to trust CRUD works, not exhaustive.
- Dev tooling: `tsx` for dev server with watch mode (no build step
  needed during dev); `npm run build` → `tsc` for production; `npm
  start` runs the compiled `dist/`.
- `DATABASE_URL` via `.env` (Prisma requirement); `.env.example`
  committed, `.env` gitignored.

## Out of scope (this spec)

- Flutter client changes (switching off `MockJournalRepository`,
  computing the placeholder gradient client-side for zero-photo
  entries, create/edit UI) — separate work, not part of this backend spec.
- Auth, multi-user support — explicitly not needed (single-user personal
  app).
- Cloud/S3 photo storage — local disk is sufficient at this scale.
