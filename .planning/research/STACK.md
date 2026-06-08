# Technology Stack — Stabilization Research

**Project:** FreeCouncil v1.0 Stabilization
**Researched:** 2026-06-07
**Scope:** Three targeted fix areas only — TypeScript build errors, Express auth middleware, SQLite session ownership persistence

---

## Fix Area 1: TypeScript Build Errors

### BUG-01 — Missing `createRateLimitMiddleware` import in `upload.ts`

**Root cause (confirmed by code inspection):**
`backend/src/routes/upload.ts` calls `createRateLimitMiddleware` at line 10 but never imports it.
`backend/src/middleware/rateLimit.ts` exports the function as a named export.

**Fix pattern:**
Add one import line to `upload.ts`:

```typescript
import { createRateLimitMiddleware } from '../middleware/rateLimit.js';
```

This is identical to the import already present in `backend/src/routes/api.ts` line 14. No type changes, no new libraries. The `.js` extension is required because the backend targets `"module": "NodeNext"` with `"type": "module"` in `backend/package.json`.

**Confidence:** HIGH — direct code inspection confirms the missing import and the export.

---

### BUG-02 — `abortSignal` undefined variable in `RouterAgent.ts`

**Root cause (confirmed by code inspection):**
`RouterAgent.sampleAgents()` accepts `timeoutMs: number` as the last parameter (line 55) but the `fetch()` call at line 114 passes `signal: abortSignal`. `abortSignal` is never declared or received in the method signature. TypeScript strict mode raises TS2552 (cannot find name).

The method receives `timeoutMs: number`, not an `AbortSignal`. The timeout logic should create its own controller internally using that duration.

**Fix pattern:**
Create an `AbortController` inside `sampleAgents` from `timeoutMs`, then use its signal:

```typescript
static async sampleAgents(
  query: string,
  models: NormalizedModelCapabilities[],
  k: number,
  apiKey: string,
  containsUpload: boolean = false,
  reasoningEffort: string = 'Balanced',
  promptClass: 'simple' | 'non_trivial' = 'non_trivial',
  freeLockEnabled: boolean = true,
  budgetEscalated: boolean = false,
  timeoutMs: number = RouterAgent.SAMPLE_AGENTS_TIMEOUT_MS
): Promise<AgentPlan> {
  // Create abort controller from timeoutMs
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const abortSignal = controller.signal;  // now locally in scope

  try {
    // ... existing logic using abortSignal ...
  } finally {
    clearTimeout(timeoutId);
  }
}
```

Key TypeScript patterns:
- `AbortController` and `AbortSignal` are built-in global types in Node.js 22 and TypeScript's `lib.dom.d.ts` / `lib.dom.asynciterable.d.ts`. No import needed.
- The `finally` block clears the timeout to prevent the timer keeping the process alive after the call completes.
- `AbortSignal.any([...])` (used in `AgentOrchestrator.ts`) requires Node.js 20.3+ / TypeScript 5.1+; both are satisfied by this stack (Node 22, TS 5.x). No change needed there.

**Alternative — if caller needs external abort propagation:**
Change the signature to accept `AbortSignal | undefined` instead of `timeoutMs`:

```typescript
static async sampleAgents(
  ...
  abortSignal?: AbortSignal  // replaces timeoutMs
): Promise<AgentPlan> {
```

But this breaks the call site in `councilDispatch.ts` line 103 which passes `abortSignal` (already typed `AbortSignal | undefined`). The internal-controller pattern is cleaner and preserves backward-compatible signature.

**Confidence:** HIGH — direct code inspection, TypeScript built-in types verified.

---

### BUG-03 — `AbortSignal | undefined` passed where `number` expected in `councilDispatch.ts`

**Root cause (confirmed by code inspection):**
`councilDispatch.ts` line 103 calls `RouterAgent.sampleAgents(...)` and passes `abortSignal` (typed `AbortSignal | undefined` from the options object) as the last positional argument. `sampleAgents`'s last parameter is `timeoutMs: number`. TypeScript TS2345 fires because `AbortSignal | undefined` is not assignable to `number`.

**Fix pattern (tied directly to BUG-02 fix):**

If BUG-02 is fixed by the internal-controller pattern (recommended), the `councilDispatch.ts` call site must stop passing `abortSignal` as the last argument. The current call:

```typescript
const plan = await RouterAgent.sampleAgents(
  query, freeModels, k, apiKey, containsUpload,
  effort, promptClass === 'complex' ? 'non_trivial' : 'simple',
  freeLockEnabled, budgetEscalated, abortSignal   // <-- BUG-03: AbortSignal passed as timeoutMs
);
```

Fix — drop `abortSignal` from the call (RouterAgent manages its own timeout internally):

```typescript
const plan = await RouterAgent.sampleAgents(
  query, freeModels, k, apiKey, containsUpload,
  effort, promptClass === 'complex' ? 'non_trivial' : 'simple',
  freeLockEnabled, budgetEscalated
  // timeoutMs uses its default value; RouterAgent creates AbortController internally
);
```

The `abortSignal` from `CouncilDispatchOptions` is still used at line 196 where `AgentOrchestrator.executeGoALite(plan, enrichedQuery, apiKey, sessionId, abortSignal)` is called — that call is correct (`executeGoALite` accepts `abortSignal?: AbortSignal`). No change needed there.

**Confidence:** HIGH — direct code inspection of both files confirms the type mismatch and the correct fix path.

---

### TypeScript Strict Mode — General Pattern Reference

The backend `tsconfig.json` targets `ES2022` with `"module": "NodeNext"`. Under `strict: true`:

- Optional parameters typed `T | undefined` cannot be passed where `T` is expected without narrowing.
- Variables used before declaration (TS2552) are always errors in strict mode.
- Pattern for narrowing `AbortSignal | undefined` before use: `if (signal != null) { ... }` or default to `new AbortController().signal`.
- `.js` extension is mandatory on all local imports under `NodeNext` module resolution — already the convention throughout this codebase.

No new npm packages are needed for any of the three TypeScript fixes.

---

## Fix Area 2: Express Auth Middleware (`requireApiKey`)

### Pattern: Stateless Bearer-Token Gate

**Purpose:** Gates Express routes that mutate state (POST /config, PATCH /session/:id/revert, POST /dispatch, GET /config, GET /quota) behind a valid API key check without storing the raw key anywhere.

**Design constraints from codebase:**
- The raw API key must never be stored in SQLite (PROJECT.md constraint).
- SHA-256 hash is already used in `SessionRegistry.hashApiKey()` via `node:crypto`.
- All requests arrive as `Authorization: Bearer <key>`.
- The app is single-user — there is one "valid" API key (the one the user entered via the onboarding modal, forwarded to OpenRouter).
- There is no server-side secret to compare against. Validation works by forwarding the key to OpenRouter and checking the response, OR by comparing hashes of sessions owned by this key.

**Recommended middleware implementation:**

```typescript
// backend/src/middleware/requireApiKey.ts
import { Request, Response, NextFunction } from 'express';
import { extractBearerToken } from '../modules/sessionRegistry.js';

export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = extractBearerToken(req.headers.authorization);
  if (!apiKey) {
    res.status(401).json({ error: 'Authorization required' });
    return;
  }
  // Attach for downstream use — do NOT log, do NOT persist
  (req as any).apiKey = apiKey;
  next();
}
```

**Why this approach:**
- `extractBearerToken` already exists in `sessionRegistry.ts` — reusing it keeps hashing logic in one place.
- The middleware only checks presence and format of the token. It does NOT validate the key against OpenRouter on every request (that would add latency and burn quota). The key is validated implicitly when it is forwarded to OpenRouter in dispatch calls.
- Attaching `req.apiKey` gives downstream handlers access without re-parsing the header.
- Stateless — no session lookup, no DB hit, no async work. Express `NextFunction` pattern with synchronous guard.

**Session ownership check (SEC-01, SEC-02):**
For routes that also need to verify the caller owns the target session, a second middleware or an inline check uses `SessionRegistry.isOwnedBy(sessionId, apiKey)`. After DEBT-01 is resolved (see Fix Area 3 below), this check should read from SQLite instead of the in-memory registry.

**Placement:**
Apply `requireApiKey` before the route handler in `api.ts`:

```typescript
apiRouter.post('/config', requireApiKey, async (req, res) => { ... });
apiRouter.get('/config', requireApiKey, async (req, res) => { ... });
apiRouter.get('/quota', requireApiKey, async (req, res) => { ... });
apiRouter.patch('/session/:id/revert', requireApiKey, requireOwnedSession, async (req, res) => { ... });
```

**What NOT to add:**
- Do not add `express-rate-limit` or `helmet` — both require npm packages; the codebase uses its own in-memory rate limiter already.
- Do not add JWT or OAuth — single-user app with a bearer key is sufficient.
- Do not add a middleware that calls OpenRouter for key validation on every non-dispatch request — prohibitive latency.
- Do not store or compare a server-side hashed "canonical" key. The OpenRouter key changes when the user re-enters it; a stored hash would immediately go stale and lock the user out.

**Confidence:** HIGH — pattern is consistent with existing `extractBearerToken` + `hashApiKey` infrastructure already in the codebase.

---

### Pattern: `requireOwnedSession` Middleware

For routes that need both auth AND ownership:

```typescript
// Can live in the same file as requireApiKey, or inline in route handlers
export function requireOwnedSession(req: Request, res: Response, next: NextFunction): void {
  const sessionId = req.params.id || (req.query.sessionId as string);
  const apiKey = (req as any).apiKey as string | undefined;
  if (!apiKey || !sessionId) {
    res.status(400).json({ error: 'Session ID and API key required' });
    return;
  }
  // After DEBT-01: read from SessionStore (SQLite) instead of SessionRegistry (in-memory)
  if (!SessionRegistry.isOwnedBy(sessionId, apiKey)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
}
```

Note: Until DEBT-01 is fully resolved, `requireOwnedSession` must fall back to SessionRegistry. After DEBT-01, the ownership check should query the `sessions` table directly.

---

## Fix Area 3: Session Ownership Persistence (DEBT-01)

### Problem Statement

`SessionRegistry` is an in-memory `Map` in `sessionRegistry.ts`. It holds `ownerApiKeyHash` per session. On any process restart, the map is empty — all existing sessions lose their ownership record, so `isOwnedBy()` returns `false` for every session. This breaks the auth middleware (SEC-01/02) for any session that survived a restart.

`SessionStore` (SQLite `sessions` table) survives restarts but currently lacks an `owner_api_key_hash` column.

### Required Schema Change

Add migration `008_session_owner.sql`:

```sql
ALTER TABLE sessions ADD COLUMN owner_api_key_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_sessions_owner_hash ON sessions(owner_api_key_hash);
```

Using `ALTER TABLE ... ADD COLUMN` (SQLite 3.x supported; no DEFAULT needed — NULL is acceptable for existing rows that predate this migration).

The index enables efficient `listOwnedSessionIds` queries by hash without scanning all sessions.

**Confidence:** HIGH — `node:sqlite` `DatabaseSync` supports all standard SQLite DDL including `ALTER TABLE ADD COLUMN`. Confirmed via Context7 Node.js docs.

### Required Code Changes

**1. `SessionStore.createSession()` — persist the hash:**

```typescript
createSession(sessionId: string, modelId: string, mode: string, apiKey: string, now = Date.now()): SessionRecord {
  const ownerApiKeyHash = hashApiKey(apiKey);
  db.prepare(`
    INSERT INTO sessions (id, model_id, mode, owner_api_key_hash, created_at, last_activity)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(sessionId, modelId, mode, ownerApiKeyHash, now, now);
  return { sessionId, modelId, mode, ownerApiKeyHash, createdAt: now, lastActivity: now };
}
```

Import `hashApiKey` from `sessionRegistry.ts` (it is already exported). This respects the import order constraint: `db → modules → agents → dispatch → routes`. `sessionStore.ts` is in modules and already imports from db; importing a pure function from another module in the same layer is acceptable.

**Alternative:** copy the hash implementation inline in `sessionStore.ts` to avoid the cross-module dependency. `crypto.createHash('sha256').update(apiKey).digest('hex')` is a one-liner. This is preferred to avoid any potential future circular import if `sessionRegistry.ts` ever imports from `sessionStore.ts`.

**2. `SessionStore` — add ownership query methods:**

```typescript
isOwnedBy(sessionId: string, apiKey: string): boolean {
  const ownerHash = hashApiKey(apiKey);
  const row = db.prepare(
    'SELECT 1 FROM sessions WHERE id = ? AND owner_api_key_hash = ?'
  ).get(sessionId, ownerHash);
  return row != null;
},

listOwnedSessionIds(apiKey: string): string[] {
  const ownerHash = hashApiKey(apiKey);
  const rows = db.prepare(
    'SELECT id FROM sessions WHERE owner_api_key_hash = ? ORDER BY last_activity DESC'
  ).all(ownerHash) as { id: string }[];
  return rows.map(r => r.id);
},
```

**3. `SessionRecord` interface — add the field:**

```typescript
export interface SessionRecord {
  sessionId: string;
  modelId: string;
  mode: string;
  ownerApiKeyHash: string | null;  // null for sessions created before migration 008
  createdAt: number;
  lastActivity: number;
}
```

**4. Hydration on startup — two options:**

Option A (recommended, simpler): Remove `SessionRegistry` as the ownership source of truth entirely. Ownership queries go directly to `SessionStore`. `SessionRegistry.isOwnedBy` and `SessionRegistry.listOwnedSessionIds` become thin wrappers that call `SessionStore` equivalents. The in-memory `sessions` Map in `sessionRegistry.ts` can be removed or kept only for the `modelId` and `mode` fields if those are needed in-memory.

Option B (DEBT-01 minimal): On startup in `backend/src/index.ts`, after migrations run, hydrate `SessionRegistry` from all non-expired sessions in SQLite:

```typescript
// In index.ts after runMigrations()
const activeRows = db.prepare(
  'SELECT id, model_id, mode, owner_api_key_hash FROM sessions WHERE last_activity > ? AND owner_api_key_hash IS NOT NULL'
).all(Date.now() - SESSION_TTL_MS) as { id: string; model_id: string; mode: string; owner_api_key_hash: string }[];

for (const row of activeRows) {
  // Reconstruct registry entry without re-hashing (hash already stored)
  sessions.set(row.id, {
    sessionId: row.id,
    modelId: row.model_id,
    mode: row.mode,
    ownerApiKeyHash: row.owner_api_key_hash
  });
}
```

This requires either exporting the `sessions` Map or exposing a `SessionRegistry.hydrate(rows)` method.

**Recommendation:** Option A (make SessionStore the source of truth for ownership). Option B (hydration) still has a race condition: sessions created after startup but before the hydration loop is complete will be missing from the registry briefly. Option A eliminates this entire class of bug. The `sessions` Map in `SessionRegistry` then becomes redundant and can be removed, which directly addresses the architectural anti-pattern documented in `ARCHITECTURE.md`.

### node:sqlite Patterns for Ownership Queries

All `node:sqlite` operations are synchronous (`DatabaseSync`). The `statement.get()` method returns a single row object or `undefined`. The `statement.all()` method returns an array of row objects. These match the existing patterns in `sessionStore.ts` and `ftsSearchService.ts` — no new API surface to learn.

```typescript
// Ownership check — synchronous, no async/await needed
const row = db.prepare(
  'SELECT 1 FROM sessions WHERE id = ? AND owner_api_key_hash = ?'
).get(sessionId, hashApiKey(apiKey));
return row != null;
```

**What NOT to add:**
- Do not add an ORM or query builder — the codebase uses raw SQL throughout, consistent with existing patterns.
- Do not add bcrypt or argon2 for hashing the API key — SHA-256 via `node:crypto` is already the established pattern (`SessionRegistry.hashApiKey`). The API key is high-entropy (OpenRouter keys are 64+ character random strings), so SHA-256 without salt is sufficient for this threat model. Adding bcrypt would add async complexity incompatible with the synchronous `node:sqlite` pattern.
- Do not add a separate migration library — the existing `migrationRunner.ts` applies sequential numbered `.sql` files; adding `008_session_owner.sql` follows this exact pattern.
- Do not cache hashes in memory separately from the DB row — one source of truth.

**Confidence:** HIGH — all patterns derived from direct inspection of existing `sessionStore.ts`, `sessionRegistry.ts`, `connection.ts`, and confirmed against Context7 Node.js `node:sqlite` documentation.

---

## Integration Constraints

| Constraint | Source | Impact |
|---|---|---|
| `"module": "NodeNext"` | `backend/tsconfig.json` | All local imports must use `.js` extension |
| `import order: db → modules → agents → dispatch → routes` | `PROJECT.md`, `ARCHITECTURE.md` | `sessionStore.ts` can import from `db/` and `node:crypto`; cannot import from `agents/` or `dispatch/` |
| API key never logged or stored in SQLite raw | `PROJECT.md` constraint | Only SHA-256 hash stored; hash function is `node:crypto` already in use |
| `node:sqlite` synchronous API | `connection.ts` | Ownership queries are synchronous; no `async/await` needed in `SessionStore` methods |
| No paid npm packages | `PROJECT.md` constraint | All fixes use Node.js built-ins (`node:crypto`, `node:sqlite`) and existing dependencies |
| Express 4.19.2 | `backend/package.json` | Middleware signature is `(req, res, next)` — standard Express 4.x pattern; `NextFunction` from `express` types |

---

## Version Pins (No Changes Needed)

| Package | Current Version | Status |
|---|---|---|
| TypeScript | 5.x | No upgrade needed; all fixes use existing type capabilities |
| Express | 4.19.2 | No upgrade needed; standard middleware pattern |
| Node.js built-ins (`node:crypto`, `node:sqlite`) | Node 22.5+ | Already in use; no new APIs required |
| `cors` | 2.8.5 | Unchanged |
| `dotenv` | 16.4.5 | Unchanged |

---

## Sources

- Direct code inspection: `backend/src/routes/upload.ts`, `backend/src/agents/RouterAgent.ts`, `backend/src/dispatch/councilDispatch.ts`, `backend/src/middleware/rateLimit.ts`, `backend/src/modules/sessionRegistry.ts`, `backend/src/modules/sessionStore.ts`, `backend/src/db/connection.ts`, `backend/src/db/migrations/007_sessions.sql`
- Context7 / Node.js docs (`/nodejs/node`): `DatabaseSync`, `StatementSync.get()`, `StatementSync.all()`, `StatementSync.run()` — HIGH confidence
- Context7 / TypeScript docs (`/microsoft/typescript-website`): type narrowing, union types — HIGH confidence
- `ARCHITECTURE.md` anti-pattern documentation: Dual-Store Session Split
- `PROJECT.md`: import order constraint, API key storage constraint, budget constraint
