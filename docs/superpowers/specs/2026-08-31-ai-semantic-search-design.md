# AI Semantic Search — Design Spec

## Purpose

Let the user search their journal entries with natural language (e.g. "cozy spot with good oat milk latte", "cheap coffee in the mission") instead of exact text match on place name. Personal, single-user app — no auth, no multi-tenant concerns.

## Approach

Embedding-based semantic search: each entry's text is embedded into a vector once (on write), and a search query is embedded once per search and compared by cosine similarity against stored vectors. No LLM reasoning call at query time — this keeps search fast (one API call per search, not one per entry) and cheap.

**Alternatives considered:**
- **LLM text-to-filter per query** (interpret query into structured SQL/filter via an LLM call): more flexible for exact filters ("visited in June", "under $5") but costs an LLM call per search and adds latency. Rejected for v1 — YAGNI until semantic search proves insufficient.
- **Hybrid (semantic + structured filter extraction):** best long-term UX, but real added complexity for a personal app with a small dataset. Noted as a future extension (see below), not built now.

Chosen approach directly matches the user's original proposal: embed once, compare cheaply, no per-query LLM reasoning.

## Data Model Changes

`JournalEntry` gets a new optional field:

```prisma
notes String?
```

Free text — vibe, tasting notes, anything the user wants to remember. Gives the embedding real content beyond place/order names.

New table, one row per entry:

```prisma
model EntryEmbedding {
  id        String       @id @default(uuid())
  entryId   String       @unique
  entry     JournalEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)
  vector    String       // JSON-encoded float array, e.g. "[0.0123,-0.045,...]"
  model     String       // embedding model id, e.g. "text-embedding-3-small"
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt
}
```

Kept as a separate table (not a column on `JournalEntry`) so normal entry reads (list/get) stay cheap — the vector is only loaded during search or re-embedding. The `model` column exists so that if the embedding model is ever changed, stale-vs-current vectors are distinguishable (a re-embed script can filter on `model != currentModel`).

`onDelete: Cascade` — deleting an entry deletes its embedding automatically, consistent with how `OrderItem`/`Photo` already cascade.

## Embedding Generation

**Text blob built per entry:**
```
{placeName}. {neighborhood}, {city}. {notes ?? ''}. Ordered: {orderItems.map(i => i.name).join(', ')}.
```

**When:** on `POST /entries` and `PATCH /entries/:id`, after the entry row is written successfully, call the embeddings API with this blob and upsert the `EntryEmbedding` row. Runs inline (awaited) in the same request — no background job queue. Justification: personal app, low write volume, one HTTP call (~100-300ms) is an acceptable response-time cost, and a queue is unneeded operational complexity for a single user.

**Failure handling:** if the embedding API call fails (key missing, network error, rate limit), the entry write still succeeds and the error is logged — search just won't find that entry until it's re-embedded. Search is a layer on top of CRUD, not a hard dependency of it. A maintenance path (`POST /entries/:id/reembed`, or a one-off script) covers backfilling entries created while the embedding step was failing, and re-embedding after a model change.

**Provider:** OpenAI `text-embedding-3-small` (or equivalent small/cheap embedding model). New env var `OPENAI_API_KEY`, required only for this feature — if absent, embedding generation and `/search` are disabled gracefully (search endpoint returns a clear "not configured" error) rather than crashing the whole API.

## Search Endpoint

```
GET /search?q=<query>&limit=<n>
```

- `q` (required): free-text query.
- `limit` (optional, default 20): max results.

**Flow:**
1. Reject with 400 if `q` is missing/empty.
2. Embed `q` via the same embedding API/model (1 call).
3. Load all `EntryEmbedding` rows (low hundreds of entries — full scan is fine).
4. Compute cosine similarity between the query vector and each stored vector, in Node.
5. Filter out results below a minimum similarity threshold (~0.2, tunable) so an unrelated query doesn't return noise.
6. Sort descending by similarity, take `limit`.
7. Return full entries (same shape as `GET /entries`) in ranked order.

If `OPENAI_API_KEY` isn't configured, respond `503 { error: 'Search not configured' }` rather than 500.

## Error Handling

- Missing `q` → 400.
- Embedding provider unreachable/misconfigured → 503, not 500 (distinguishes "search is down" from "server bug").
- Entries with no `EntryEmbedding` row (never embedded, or embedding failed) are simply excluded from results — not an error.

## Testing

- Embedding API calls mocked in tests (no real network calls / API cost in CI).
- Cover: entry create/update triggers embedding upsert; entry write still succeeds when embedding call fails; search ranks by similarity; search excludes un-embedded entries; search respects `limit`; 400 on missing `q`; 503 when API key unset.

## Out of Scope (v1)

- Structured filter extraction (date ranges, price ranges, city) combined with semantic search — future extension if semantic-only search proves insufficient.
- Background/async embedding queue — revisit only if write latency becomes a real problem.
- Vector index (sqlite-vec extension or dedicated vector DB) — only needed if entry count grows past low hundreds; brute-force cosine in Node is fine at this scale.
- Re-ranking or LLM-generated result summaries.
