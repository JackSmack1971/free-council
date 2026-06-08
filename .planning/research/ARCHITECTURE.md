# Architecture: Auth Middleware and Session Persistence Integration

**Project:** FreeCouncil v1.0 Stabilization
**Researched:** 2026-06-07
**Confidence:** HIGH — all findings are derived from direct code inspection of the live codebase

---

## Context

The stabilization milestone requires five coordinated changes across three existing layers:

| Fix area | Layer touched | Files changed |
|----------|--------------|---------------|
| SQLite migration (owner_api_key_hash) | DB layer | new `008_*.sql`, `sessionStore.ts` |
| SessionRegistry hydration / elimination | Modules layer | `sessionStore.ts`, `sessionRegistry.ts`, `index.ts` |
| Route auth wiring | Routes layer | `api.ts` |
| TypeScript error isolation | Agent + Dispatch + Routes layers | `RouterAgent.ts`, `councilDispatch.ts`, `upload.ts` |

Import order constraint (`db → modules → agents → dispatch → routes`) is respected by all changes below — no new cross-layer dependencies are introduced.

---

## 1. SQLite Migration Strategy

### Migration number

The existing migrations are `001` through `007`. The next migration file must be named:

```
backend/src/db/migrations/008_session_owner_hash.sql
```

The migration runner (`migrationRunner.ts`) tracks applied migrations by both filename and numeric prefix. It reads all `.sql` files from the `migrations/` directory, sorts them lexicographically, and skips already-applied entries. Adding `008_session_owner_hash.sql` is sufficient — no changes to `migrationRunner.ts` are required.

### Column definition: nullable with NULL default

The `sessions` table already contains rows. An `ALTER TABLE ... ADD COLUMN` migration is the correct approach — it avoids dropping and recreating the table, which would destroy existing data.

```sql
-- 008_session_owner_hash.sql
ALTER TABLE sessions ADD COLUMN owner_api_key_hash TEXT;
```

**Why NULL (not NOT NULL):** Existing rows have no owner hash. SQLite's `ALTER TABLE ADD COLUMN` does not allow a non-constant default that would require re-scanning rows, and a placeholder value (e.g., empty string) would corrupt the ownership semantics — empty string would pass a hash equality check against an API key that hashes to empty, which is incorrect. NULL is the correct sentinel: it means "no owner recorded". The ownership check must explicitly treat NULL as "not owned by anyone" (i.e., deny access), not as a bypass.

**No index needed at migration time.** The ownership check is a point-lookup by `sessionId` (the primary key), not a scan by hash. An index on `owner_api_key_hash` would only benefit `GET /sessions` filtering, which is addressed separately under DEBT-06 and not in scope for this milestone.

### SessionStore changes

Add `owner_api_key_hash` to `SessionRecord` and `SessionRow` interfaces, and pass it through `createSession` and `getSession`:

- `SessionRecord` gains: `ownerApiKeyHash: string | null`
- `SessionRow` gains: `owner_api_key_hash: string | null`
- `SessionStore.createSession(sessionId, modelId, mode, ownerApiKeyHash, now)` — add fourth parameter
- `SessionStore.getSession` — include `owner_api_key_hash` in the SELECT and map it through `mapSessionRow`
- New method: `SessionStore.isOwnedBy(sessionId: string, apiKey: string): boolean` — queries by primary key, computes hash, compares. This is the single ownership check backed by SQLite.

`hashApiKey` already exists in `sessionRegistry.ts` — it must be moved or re-exported from `sessionStore.ts` (or a shared utility) since `sessionStore.ts` must not import from `sessionRegistry.ts` (that would invert the module dependency if registry is being eliminated).

Recommended placement for `hashApiKey` and `extractBearerToken`: keep them in `sessionRegistry.ts` for the interim (they are already imported by `api.ts` and `upload.ts`). `SessionStore.isOwnedBy` can import `hashApiKey` from `sessionRegistry.ts` only if `sessionRegistry.ts` has no import from `sessionStore.ts` — which it currently does not. This is safe under the existing layer ordering.

---

## 2. SessionRegistry Hydration Pattern

### The two strategies

**Strategy A — Hydrate on startup (keep registry as cache):**
After `runMigrations()` and before `app.listen()`, call a new function `hydrateSessionRegistry()` that reads all non-expired sessions with their `owner_api_key_hash` from SQLite and populates the in-memory `Map`. The server does not listen until hydration completes. Because `node:sqlite` is synchronous, this is a blocking call in the startup sequence — acceptable because it runs before any requests are served.

**Strategy B — Eliminate registry, read ownership from SQLite directly (full DEBT-01 resolution):**
Remove `SessionRegistry` as the ownership source of truth. Replace all `SessionRegistry.isOwnedBy()` calls with `SessionStore.isOwnedBy()`. Replace `SessionRegistry.listOwnedSessionIds()` with a SQL query. Remove the in-memory `Map`. The registry singleton either becomes a thin compatibility shim or is deleted entirely.

### Recommendation: Strategy B

Strategy A defers the root architectural defect. It re-introduces the same restart vulnerability if a session is created after hydration and before it is written to SQLite (there is no such gap in the current code, but the dual-write pattern remains fragile). Strategy B eliminates the problem entirely without adding a startup phase or risking stale registry state.

Strategy B is also simpler in terms of total code changed: `SessionRegistry.isOwnedBy()` becomes a one-line wrapper around `SessionStore.isOwnedBy()`, `requireOwnedSession` in `api.ts` calls `SessionStore` directly, and the `Map` is removed. The `createSession` call in the route still needs to populate `owner_api_key_hash` in SQLite — that is the only new write.

### Non-blocking guarantee

Because `node:sqlite` is synchronous, neither strategy requires async hydration or deferred route availability. If Strategy A is chosen, the hydration call is placed synchronously between `runMigrations()` and `ModelPoolManager.refresh()` in `index.ts`. No `Promise`, no `await`, no risk of the server accepting requests before ownership data is loaded.

### What changes in index.ts (Strategy B)

No changes to `index.ts` are required under Strategy B. The registry is consulted at request time via `requireOwnedSession`, not at startup.

### What changes in index.ts (Strategy A)

```typescript
// After runMigrations(), before ModelPoolManager.refresh()
hydrateSessionRegistry();  // synchronous, reads sessions table, populates Map
```

`hydrateSessionRegistry` would be exported from `sessionRegistry.ts` and call `db.prepare(...)` to read all non-expired sessions.

---

## 3. Route Auth Wiring

### Current state

| Endpoint | requireApiKey | Ownership check | Target state |
|----------|--------------|-----------------|--------------|
| POST /session | applied | n/a (creates session) | no change |
| GET /models | applied | n/a | no change |
| POST /dispatch | NOT applied | NOT applied | apply both |
| PATCH /session/:id/revert | NOT applied | NOT applied | apply both |
| POST /config | NOT applied | n/a (global config) | apply requireApiKey + validate enum |
| GET /config | NOT applied | n/a | apply requireApiKey |
| GET /quota | NOT applied | n/a | apply requireApiKey |
| GET /session/:id/messages | via requireOwnedSession | applied | no change |
| POST /session/:id/event | via requireOwnedSession | applied | no change |
| GET /sessions | applied | applied (registry) | update to use SessionStore |

### Integration point: POST /dispatch ownership check

The ownership check for `POST /dispatch` cannot be done via `requireOwnedSession` (which returns a `SessionState` and calls `res.status(404)` on missing session) because `POST /dispatch` already calls `SessionStore.getSession()` and returns 404 if not found. Adding the ownership check must happen after the session lookup, not before.

The correct insertion point is immediately after `SessionStore.touchSession(sessionId)` at line 237 of `api.ts`:

```typescript
// After SessionStore.touchSession(sessionId)
const dispatchApiKey = extractBearerToken(req.headers.authorization);
if (!dispatchApiKey) {
  return res.status(401).json({ error: 'API key is missing' });
}
if (!SessionStore.isOwnedBy(sessionId, dispatchApiKey)) {
  return res.status(403).json({ error: 'Forbidden' });
}
```

The existing `const apiKey = extractBearerToken(req.headers.authorization) ?? '';` on line 239 can be replaced by using `dispatchApiKey` directly — avoiding a second `extractBearerToken` call.

**Do not add `requireApiKey` as middleware to `POST /dispatch`** — `requireApiKey` calls `next()` with no arguments (not Express-typed `NextFunction`). It is a local function, not a proper middleware chain entry. Inline the check, or fix the middleware signature first. The inline approach is safer and consistent with the existing `requireOwnedSession` helper pattern.

### Integration point: PATCH /session/:id/revert

The existing handler does not call `requireOwnedSession`. Add the ownership check before the `TelemetryEngine.record()` call:

```typescript
apiRouter.patch('/session/:id/revert', (req: Request, res: Response) => {
  const sessionId = req.params.id;
  // ... existing session existence check ...

  // Add: ownership check
  if (!requireOwnedSession(req, res, sessionId)) return;

  // ... existing TelemetryEngine.record() + SessionStore.updateSessionMode() ...
});
```

Note: `requireOwnedSession` currently calls `SessionRegistry.getSession()` and `SessionRegistry.isOwnedBy()`. Under Strategy B (DEBT-01 resolution), update `requireOwnedSession` to call `SessionStore.isOwnedBy()` directly.

### Integration point: POST /config, GET /config, GET /quota

These three endpoints need only `requireApiKey` as middleware — no session-scoped ownership check. The `requireApiKey` function already exists as a local constant in `api.ts`.

Add the middleware argument directly to the route registrations:

```typescript
apiRouter.get('/config', requireApiKey, (req, res) => { ... });
apiRouter.post('/config', requireApiKey, (req, res) => { ... });
apiRouter.get('/quota', requireApiKey, (req, res) => { ... });
```

Note: `requireApiKey` is typed as `(req: Request, res: Response, next: () => void) => void`. Express route handlers accept `RequestHandler` which types `next` as `NextFunction`. This is a minor type mismatch that does not cause a runtime error but may produce a TypeScript warning. If strict mode surfaces this, change the signature to `NextFunction` from `express`:

```typescript
import { Router, Request, Response, NextFunction } from 'express';
const requireApiKey = (req: Request, res: Response, next: NextFunction) => { ... };
```

### POST /config enum validation

SEC-03 also requires validating the `default_mode` enum value. Add before the db write:

```typescript
if (default_mode !== undefined && default_mode !== 'solo' && default_mode !== 'council') {
  return res.status(400).json({ error: 'Invalid default_mode. Must be solo or council.' });
}
```

---

## 4. TypeScript Fix Isolation

Each of the three TypeScript errors is in a separate file and each fix is independent of the other two.

### BUG-01: upload.ts:10 — missing import for createRateLimitMiddleware

**What is broken:** `upload.ts` calls `createRateLimitMiddleware(...)` on line 10 but never imports it. The function exists at `backend/src/middleware/rateLimit.ts`.

**Fix:** Add import at the top of `upload.ts`:

```typescript
import { createRateLimitMiddleware } from '../middleware/rateLimit.js';
```

This is a pure import addition — no logic changes, no type changes.

### BUG-02: RouterAgent.ts:114 — abortSignal referenced but not in scope

**What is broken:** Inside `sampleAgents()`, the `fetch()` call on line 114 passes `signal: abortSignal` in the fetch options. But `sampleAgents`' parameter list ends with `timeoutMs: number` — there is no `abortSignal` parameter. The variable `abortSignal` is not defined anywhere in scope within `sampleAgents`.

**Fix:** `sampleAgents` needs to construct its own `AbortSignal` from the `timeoutMs` parameter (which already exists for exactly this purpose), or accept an optional `AbortSignal` parameter. The correct fix that aligns the two layers:

Option 1 — Use `AbortSignal.timeout(timeoutMs)` inside `sampleAgents` (self-contained, no signature change):

```typescript
signal: AbortSignal.timeout(timeoutMs)
```

Option 2 — Add `abortSignal?: AbortSignal` as an 11th parameter to `sampleAgents` and update all call sites.

Option 1 is preferred under the Code-Simplifier Doctrine (minimal, local change). `AbortSignal.timeout()` is available in Node.js 17.3+ and is present in Node.js 22 which this project targets.

### BUG-03: councilDispatch.ts:103 — AbortSignal passed as timeoutMs

**What is broken:** The call to `RouterAgent.sampleAgents()` at line 100-104 of `councilDispatch.ts` passes `abortSignal` (type `AbortSignal | undefined`) as the 10th argument, where `timeoutMs: number` is expected.

**Root cause:** The caller wants abort propagation. The callee has a `timeoutMs` slot but no `abortSignal` slot.

**Fix (coordinated with BUG-02):**

If BUG-02 is fixed with Option 1 (timeout inside `sampleAgents`): remove `abortSignal` from the call site in `councilDispatch.ts`:

```typescript
const plan = await RouterAgent.sampleAgents(
  query, freeModels, k, apiKey, containsUpload,
  effort, promptClass === 'complex' ? 'non_trivial' : 'simple',
  freeLockEnabled, budgetEscalated
  // abortSignal removed — sampleAgents uses AbortSignal.timeout(timeoutMs) internally
);
```

If BUG-02 is fixed with Option 2 (add `abortSignal` parameter): update the call site to pass it in the correct 11th slot.

Option 1 is recommended: it removes an argument from the call site (simpler), uses the existing `timeoutMs` correctly, and does not require updating any other callers of `sampleAgents`.

---

## 5. Suggested Build Order

The three fix areas are logically independent but share a data dependency: the ownership check (fix area 2 + 3) relies on the `owner_api_key_hash` column existing in SQLite (fix area 1). Build in this order:

### Step 1 — TypeScript error fixes (BUG-01, BUG-02, BUG-03)

Files: `upload.ts`, `RouterAgent.ts`, `councilDispatch.ts`

These three fixes are fully independent of each other and of the session ownership work. Fix them first so the TypeScript build is clean and tests can run. None of them touch session state or auth.

- BUG-01: add one import line to `upload.ts`
- BUG-02 + BUG-03: coordinated change — fix `RouterAgent.ts` first (remove `signal: abortSignal`, replace with `signal: AbortSignal.timeout(timeoutMs)`), then remove the trailing `abortSignal` argument from the `councilDispatch.ts` call site

### Step 2 — SQLite migration (DEBT-01 part 1)

Files: `backend/src/db/migrations/008_session_owner_hash.sql`, `sessionStore.ts`, `sessionRegistry.ts`

- Create `008_session_owner_hash.sql` with the `ALTER TABLE` statement
- Extend `SessionRecord`, `SessionRow`, `SessionStore.createSession`, `SessionStore.getSession` to include `owner_api_key_hash`
- Add `SessionStore.isOwnedBy(sessionId, apiKey)` method (importing `hashApiKey` from `sessionRegistry.ts`)
- Verify with `tsc --noEmit` before proceeding

### Step 3 — SessionRegistry hydration / elimination (DEBT-01 part 2)

Files: `sessionRegistry.ts`, `api.ts`, `index.ts` (if Strategy A)

Under Strategy B (recommended):
- Update `requireOwnedSession` in `api.ts` to call `SessionStore.isOwnedBy()` instead of `SessionRegistry.isOwnedBy()`
- Update `GET /sessions` to query `sessions` table with `owner_api_key_hash` filter instead of consulting the in-memory Map
- Keep `SessionRegistry.createSession()` and `SessionRegistry.updateMode()` as thin no-ops or remove them — the `POST /session` route calls both; under Strategy B, only the `SessionStore.createSession()` call matters for ownership persistence
- Keep `extractBearerToken` and `hashApiKey` in `sessionRegistry.ts` (they are imported by multiple files); do not move them in this milestone

### Step 4 — Route auth wiring (SEC-01 through SEC-04)

Files: `api.ts` only

- Apply `requireApiKey` to `GET /config`, `POST /config`, `GET /quota`
- Add `default_mode` enum validation in `POST /config`
- Add ownership check to `POST /dispatch` (inline, after session lookup)
- Add `requireOwnedSession` call to `PATCH /session/:id/revert`

This step depends on Step 3 being complete so that `requireOwnedSession` uses the SQLite-backed ownership check.

---

## Component Interaction Summary

```
POST /dispatch flow (after fixes):
  api.ts (route)
    → extractBearerToken()                        [sessionRegistry.ts — unchanged]
    → SessionStore.getSession(sessionId)          [sessionStore.ts — unchanged]
    → SessionStore.touchSession(sessionId)        [sessionStore.ts — unchanged]
    → SessionStore.isOwnedBy(sessionId, apiKey)   [sessionStore.ts — NEW]
      → hashApiKey(apiKey)                        [sessionRegistry.ts — unchanged]
      → db.prepare(...).get(sessionId)            [connection.ts — unchanged]
    → dispatchCouncilChat() or dispatchSoloChat() [dispatch layer — unchanged]

POST /session flow (after fixes):
  api.ts (route)
    → SessionStore.createSession(..., ownerApiKeyHash)  [sessionStore.ts — MODIFIED]
    → SessionRegistry.createSession(...)                [sessionRegistry.ts — kept for compatibility]

Startup flow (Strategy B — no change to index.ts):
  runMigrations()          [applies 008_session_owner_hash.sql]
  ModelPoolManager.refresh()
  app.listen()
```

---

## New vs Modified Files

| File | Status | Change |
|------|--------|--------|
| `backend/src/db/migrations/008_session_owner_hash.sql` | NEW | ALTER TABLE sessions ADD COLUMN owner_api_key_hash TEXT |
| `backend/src/modules/sessionStore.ts` | MODIFIED | Add owner_api_key_hash to interfaces, createSession, getSession; add isOwnedBy() |
| `backend/src/modules/sessionRegistry.ts` | MODIFIED | hashApiKey/extractBearerToken remain; Map-based ownership methods become no-ops or thin wrappers |
| `backend/src/routes/api.ts` | MODIFIED | requireApiKey on 3 endpoints; ownership check in dispatch + revert; enum validation in POST /config |
| `backend/src/routes/upload.ts` | MODIFIED | Add missing import for createRateLimitMiddleware |
| `backend/src/agents/RouterAgent.ts` | MODIFIED | Replace `signal: abortSignal` with `signal: AbortSignal.timeout(timeoutMs)` |
| `backend/src/dispatch/councilDispatch.ts` | MODIFIED | Remove trailing abortSignal argument from sampleAgents call |
| `backend/src/index.ts` | NO CHANGE (Strategy B) | — |

---

## Pitfalls to Avoid

**NULL ownership on pre-migration sessions:** After running migration 008, existing sessions have `owner_api_key_hash = NULL`. Any ownership check must treat NULL as "unowned" (deny access), not as "any key matches". The SQLite comparison `NULL = <value>` evaluates to NULL (not false), so an inline check like `WHERE owner_api_key_hash = ?` will correctly return no rows for NULL columns — but an application-level check must also handle `null` explicitly.

**Double requireApiKey on dispatch:** Do not add `requireApiKey` as Express middleware to `POST /dispatch`. The route already reads the API key for forwarding to OpenRouter. Add the ownership check inline, reusing the already-extracted key, to avoid two `extractBearerToken` calls.

**Migration idempotency:** The migration runner checks by filename before applying. Do not add `IF NOT EXISTS` to `ALTER TABLE ADD COLUMN` — SQLite does not support that syntax for `ALTER TABLE`. The migration runner's skip-if-already-applied logic is the idempotency mechanism.

**requireApiKey next() type:** The local `requireApiKey` in `api.ts` types `next` as `() => void`. When passing it as Express middleware to route registrations (`router.get('/config', requireApiKey, handler)`), TypeScript in strict mode may warn because Express expects `NextFunction`. Fix the type signature when wiring the middleware to avoid a latent type error.

---

*Research basis: direct code inspection of all referenced files. Confidence HIGH.*
