# Feature Landscape: Session Auth Hardening

**Domain:** Express API auth gating, session ownership enforcement, dual-store collapse
**Milestone:** v1.0 Stabilization — hardening only, no new features
**Researched:** 2026-06-07
**Confidence:** HIGH — all findings derived from direct codebase reading; no training-data assertions

---

## Codebase State Summary (as-read)

The following already exists and must not be duplicated or replaced wholesale:

| Symbol | File | Status |
|--------|------|--------|
| `extractBearerToken()` | `sessionRegistry.ts` | Present, correct |
| `hashApiKey()` | `sessionRegistry.ts` | Present — SHA-256 via `node:crypto` |
| `SessionRegistry.isOwnedBy()` | `sessionRegistry.ts` | Present, correct logic |
| `requireApiKey` middleware | `routes/api.ts:118` | Present, inline, **not applied** to POST /dispatch, PATCH /session/:id/revert, POST /config, GET /config, GET /quota |
| `requireOwnedSession()` helper | `routes/api.ts:125` | Present, reads from `SessionRegistry` (in-memory), applied to GET /session/:id/messages and POST /session/:id/event but **not** PATCH /session/:id/revert or POST /dispatch |
| `sessions` SQLite table | `007_sessions.sql` | Present — columns: `id, model_id, mode, created_at, last_activity` — **no `owner_api_key_hash` column** |
| `SessionStore.createSession()` | `sessionStore.ts:37` | Present — does not accept or persist `apiKey` |
| `SessionRegistry.createSession()` | `sessionRegistry.ts:26` | Present — stores hash in-memory only |

---

## Section 1: API Key Auth Middleware

### Table Stakes (must fix — blocks SEC-02, SEC-03, SEC-04)

**What is needed:** Apply the existing `requireApiKey` middleware to the five unguarded routes.

The `requireApiKey` middleware at `routes/api.ts:118` is already correct:

```typescript
const requireApiKey = (req: Request, res: Response, next: () => void) => {
  if (!extractBearerToken(req.headers.authorization)) {
    return res.status(401).json({ error: 'API key is missing' });
  }
  next();
};
```

It returns HTTP 401 on missing/empty bearer token. It does not validate the key against OpenRouter — that is correct for a local-first single-user app where the key is user-supplied and OpenRouter validates it on actual API calls.

**Routes that need `requireApiKey` added:**

| Route | Issue | Current State |
|-------|-------|---------------|
| `POST /dispatch` | SEC-01 | Has `dispatchRateLimiter`, missing `requireApiKey` |
| `PATCH /session/:id/revert` | SEC-02 | No middleware at all |
| `POST /config` | SEC-03 | No middleware at all |
| `GET /config` | SEC-04 | No middleware at all |
| `GET /quota` | SEC-04 | No middleware at all |

**Correct pattern** (apply middleware in route definition):

```typescript
apiRouter.post('/dispatch', requireApiKey, dispatchRateLimiter, async (req, res) => { ... });
apiRouter.patch('/session/:id/revert', requireApiKey, (req, res) => { ... });
apiRouter.post('/config', requireApiKey, (req, res) => { ... });
apiRouter.get('/config', requireApiKey, (req, res) => { ... });
apiRouter.get('/quota', requireApiKey, (req, res) => { ... });
```

`requireApiKey` must come before `dispatchRateLimiter` on POST /dispatch so unauthenticated callers get 401, not 429.

**Key: Do not validate the API key against OpenRouter here.** Validation happens naturally when the key is forwarded in `Authorization: Bearer` headers on actual OpenRouter calls. Adding an upstream round-trip for key validation would add latency, consume quota, and require network access during tests.

### Nice-to-Have (post-stabilization)

- Comparing the hashed key against a stored hash in `app_config` for an "API key registered" check. **Defer** — not needed for single-user local app where the user always has one key active at a time.

---

## Section 2: Session Ownership Check

### Table Stakes (must fix — blocks SEC-01, SEC-02)

**What is needed:** Before POST /dispatch executes and before PATCH /session/:id/revert mutates state, verify the caller's API key hash matches the `ownerApiKeyHash` stored for that session.

**Current gap on POST /dispatch (SEC-01):**

The route extracts the API key at line 239 (`const apiKey = extractBearerToken(...) ?? ''`) but never compares it to the session owner. Any caller with any valid API key and a known `sessionId` can dispatch against another user's session and consume that session's quota.

**Current gap on PATCH /session/:id/revert (SEC-02):**

The route reads `SessionStore.getSession(sessionId)` but never calls `requireOwnedSession`. Any caller with a known `sessionId` can revert another session to solo mode.

**Correct ownership check pattern:**

The helper `requireOwnedSession()` at `routes/api.ts:125` already implements the correct logic against `SessionRegistry`:

```typescript
function requireOwnedSession(req: Request, res: Response, sessionId: string): SessionState | null {
  const apiKey = extractBearerToken(req.headers.authorization);
  if (!apiKey) { res.status(401).json({ error: 'API key is missing' }); return null; }

  const session = SessionRegistry.getSession(sessionId);
  if (!session) { res.status(404).json({ error: 'Session not found' }); return null; }

  if (!SessionRegistry.isOwnedBy(sessionId, apiKey)) {
    res.status(403).json({ error: 'Forbidden' }); return null;
  }
  return session;
}
```

**For POST /dispatch**, insert ownership check immediately after the `SessionStore.getSession()` call and before any dispatch logic:

```typescript
// After: const session = SessionStore.getSession(sessionId);
// After: if (!session) return res.status(404)...
const ownedSession = requireOwnedSession(req, res, sessionId);
if (!ownedSession) return;
// Continue with existing dispatch logic — apiKey already extracted below
```

**For PATCH /session/:id/revert**, replace the current bare `SessionStore.getSession()` lookup with `requireOwnedSession`:

```typescript
apiRouter.patch('/session/:id/revert', requireApiKey, (req, res) => {
  const sessionId = req.params.id;
  const session = requireOwnedSession(req, res, sessionId);
  if (!session) return;
  // existing TelemetryEngine.record + SessionStore.updateSessionMode logic
});
```

**Dependency on DEBT-01:** `requireOwnedSession` currently reads from `SessionRegistry` (in-memory). After DEBT-01 is resolved (ownership persisted to SQLite), `requireOwnedSession` must be updated to read `owner_api_key_hash` from `SessionStore` instead of `SessionRegistry`. Until DEBT-01 is applied, ownership checks will silently pass for all sessions after a process restart (the registry is empty, `getSession` returns null → 404, not 403). This is a known intermediate failure mode documented in the existing architecture notes.

**Ordering recommendation:** SEC-01/SEC-02 fixes should be committed together with DEBT-01. Fixing auth gates without the persistence fix means restarted processes expose a 404-on-all-sessions window that an attacker could exploit (POST any sessionId → 404 when registry empty → after restart the check degrades to "session not found" rather than "forbidden").

### Nice-to-Have (post-stabilization)

- Structured ownership error codes (e.g., `violationType: 'SESSION_NOT_OWNED'`) mirroring the `violationType` pattern already used in preflight gate errors.
- Middleware-style `requireOwnedSession` usable as an Express route handler for cleaner route signatures.

---

## Section 3: Dual-Store Collapse

### Table Stakes (must fix — DEBT-01)

**What is broken:** All sessions lose their ownership record on any process restart. `SessionRegistry` is a module-level `Map` with no persistence. After restart, `requireOwnedSession` returns 404 for every previously-valid session.

**Root cause:** `SessionStore.createSession()` signature is `(sessionId, modelId, mode, now)` — no `apiKey` parameter. The `sessions` table has no `owner_api_key_hash` column.

**The minimal correct fix has four parts:**

#### Part A: New SQL migration — add `owner_api_key_hash` column

```sql
-- 008_session_ownership.sql
ALTER TABLE sessions ADD COLUMN owner_api_key_hash TEXT NOT NULL DEFAULT '';
```

Using `DEFAULT ''` on the `ALTER TABLE` satisfies SQLite's constraint requirement for existing rows. Rows with empty hash are pre-restart orphans — they cannot satisfy an ownership check regardless of which key is presented, which is the correct degraded behavior (treat orphaned sessions as unrecoverable, not as owned-by-anyone).

**Do not** use `DEFAULT NULL` + nullable column — `SessionRegistry.isOwnedBy` uses string equality; a nullable column requires null-guard branches everywhere.

#### Part B: Update `SessionStore.createSession()` to accept and persist `apiKey`

```typescript
createSession(sessionId: string, modelId: string, mode: string, apiKey: string, now = Date.now()): SessionRecord {
  db.prepare(`
    INSERT INTO sessions (id, model_id, mode, owner_api_key_hash, created_at, last_activity)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(sessionId, modelId, mode, hashApiKey(apiKey), now, now);
  // ...
}
```

`hashApiKey` must be imported from `sessionRegistry.ts` or moved to a shared utility. Given that `sessionRegistry.ts` already exports it and `sessionStore.ts` must not import from routes, extract `hashApiKey` to a new file (e.g., `backend/src/utils/crypto.ts`) or inline it in `sessionStore.ts` using the same `crypto.createHash('sha256').update(apiKey).digest('hex')` expression. The import constraint is `db → modules → agents → dispatch → routes` — `sessionStore.ts` (modules layer) importing from `sessionRegistry.ts` (also modules layer) is safe.

#### Part C: Update `requireOwnedSession` to read from SQLite, not `SessionRegistry`

After the column exists and `SessionStore` persists the hash, `requireOwnedSession` should read ownership from `SessionStore`:

```typescript
function requireOwnedSession(req: Request, res: Response, sessionId: string): SessionRecord | null {
  const apiKey = extractBearerToken(req.headers.authorization);
  if (!apiKey) { res.status(401).json({ error: 'API key is missing' }); return null; }

  const session = SessionStore.getSession(sessionId);  // returns SessionRecord with ownerApiKeyHash
  if (!session) { res.status(404).json({ error: 'Session not found' }); return null; }

  if (session.ownerApiKeyHash !== hashApiKey(apiKey)) {
    res.status(403).json({ error: 'Forbidden' }); return null;
  }
  return session;
}
```

This requires `SessionRecord` to expose `ownerApiKeyHash` and `SessionStore.getSession()` to SELECT that column.

#### Part D: Startup hydration of `SessionRegistry` from SQLite (or remove it)

Two viable paths:

**Option 1 — Hydrate on startup (preserve SessionRegistry as a cache):**

```typescript
// In backend/src/index.ts, after runMigrations():
const rows = db.prepare('SELECT id, model_id, mode, owner_api_key_hash FROM sessions').all();
for (const row of rows) {
  SessionRegistry.hydrateSession(row.id, row.model_id, row.mode, row.owner_api_key_hash);
}
```

Requires adding `hydrateSession(sessionId, modelId, mode, ownerApiKeyHash)` to `SessionRegistry` that populates the map with a pre-hashed value (bypassing `hashApiKey`).

**Option 2 — Remove SessionRegistry from the ownership path (recommended):**

After Part C makes `requireOwnedSession` read from SQLite, `SessionRegistry` is no longer the source of truth for ownership checks. It is still used by `GET /sessions` to filter owned session IDs (`listOwnedSessionIds`). That filter should also move to SQL:

```sql
SELECT id FROM sessions WHERE owner_api_key_hash = ? ORDER BY last_activity DESC LIMIT 100
```

This makes `SessionRegistry` fully redundant for ownership. It can be retained as an in-memory cache for `updateMode` (PATCH /session/:id/revert calls `SessionRegistry.updateMode`) but that method is redundant with `SessionStore.updateSessionMode`. Removing `SessionRegistry` from the ownership path is the correct long-term state. Full removal is a separate cleanup task (DEBT scope, not SEC scope).

**Recommended sequencing for DEBT-01:**

1. Add migration `008_session_ownership.sql`
2. Add `ownerApiKeyHash` to `SessionRecord` interface and `SessionStore` SELECT/INSERT
3. Update `SessionStore.createSession()` to accept `apiKey` parameter
4. Update `POST /session` route to pass `apiKey` to `SessionStore.createSession()`
5. Update `requireOwnedSession` to read from `SessionStore` instead of `SessionRegistry`
6. Update `GET /sessions` to push the ownership filter into SQL (removes `SessionRegistry.listOwnedSessionIds`)
7. Keep `SessionRegistry` write calls in `POST /session` for now to avoid regression — add a follow-up `[DEAD]` issue for full `SessionRegistry` removal

### Nice-to-Have (post-stabilization)

- Full removal of `SessionRegistry` module once all callers are on SQLite-backed ownership
- Index on `sessions(owner_api_key_hash)` for `GET /sessions` at scale (not needed for single-user)
- `SESSION_ORPHAN_CLEANUP` pass that removes rows with empty `owner_api_key_hash` after a migration grace window

---

## Anti-Features (explicitly do not build)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| OpenRouter key validation round-trip on every request | Adds latency, consumes quota, requires network in tests | Let OpenRouter reject the key naturally on the first actual API call |
| Multi-user session isolation (RLS, user table) | Contradicts single-user local-first architecture; out of scope | Keep single API key = single user model |
| JWT or session cookie auth | Unnecessary complexity for local app; no browser auth flows | Keep `Authorization: Bearer <key>` throughout |
| Separate `requireOwner` middleware replacing the helper function | Current helper pattern is consistent with existing code; a middleware factory adds indirection with no benefit | Keep `requireOwnedSession` as a helper called at the top of handler bodies |
| Storing the raw API key in SQLite | Security invariant violation | Store only SHA-256 hash |

---

## Feature Dependencies

```
DEBT-01 (dual-store collapse)
  └── requires: migration 008_session_ownership.sql
  └── requires: SessionStore.createSession() signature change
  └── blocks:   requireOwnedSession reading from SQLite
  └── unblocks: SEC-01 (dispatch ownership check survives restarts)
  └── unblocks: SEC-02 (revert ownership check survives restarts)
  └── enables:  DEBT-06 (GET /sessions LIMIT + SQL ownership filter)

SEC-01 (POST /dispatch ownership check)
  └── requires: requireApiKey applied to /dispatch
  └── requires: requireOwnedSession called inside dispatch handler
  └── fully correct only after: DEBT-01

SEC-02 (PATCH /session/:id/revert)
  └── requires: requireApiKey applied to /revert
  └── requires: requireOwnedSession called inside revert handler
  └── fully correct only after: DEBT-01

SEC-03 (POST /config requireApiKey)
  └── requires: requireApiKey middleware only — no ownership check needed (config is global, not session-scoped)

SEC-04 (GET /config, GET /quota requireApiKey)
  └── requires: requireApiKey middleware only — no ownership check needed
```

---

## Complexity Summary

| Work Item | Complexity | Files Touched |
|-----------|------------|---------------|
| Apply `requireApiKey` to 5 routes | Low — single-line per route | `routes/api.ts` |
| Call `requireOwnedSession` in POST /dispatch | Low — 2-line insertion | `routes/api.ts` |
| Call `requireOwnedSession` in PATCH /session/:id/revert | Low — replace existing lookup | `routes/api.ts` |
| Migration 008 + `owner_api_key_hash` column | Low — one SQL file + one interface update | new migration, `sessionStore.ts`, `shared/index.ts` |
| `SessionStore.createSession()` signature change | Medium — touches call sites in `routes/api.ts` and `sessionStore.test.ts` | `sessionStore.ts`, `routes/api.ts`, `sessionStore.test.ts` |
| `requireOwnedSession` reads from SQLite | Low — swap `SessionRegistry.getSession` for `SessionStore.getSession` | `routes/api.ts` |
| Push ownership filter into SQL for `GET /sessions` | Low — SQL WHERE clause + remove `listOwnedSessionIds` call | `routes/api.ts` |

---

## Sources

All findings are derived from direct reading of:
- `backend/src/modules/sessionRegistry.ts`
- `backend/src/modules/sessionStore.ts`
- `backend/src/routes/api.ts`
- `backend/src/db/migrations/007_sessions.sql`
- `backend/src/middleware/rateLimit.ts`
- `.planning/PROJECT.md`
- `.planning/codebase/ARCHITECTURE.md`
- `.planning/codebase/CONVENTIONS.md`

No external sources consulted. Confidence: HIGH.
