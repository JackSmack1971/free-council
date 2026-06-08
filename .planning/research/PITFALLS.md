# Domain Pitfalls — Auth/Session Stabilization

**Domain:** Adding auth middleware, session persistence, and TypeScript fixes to an existing Express/Node.js + SQLite app
**Researched:** 2026-06-07
**Scope:** Specific to the FreeCouncil v1.0 Stabilization milestone

---

## Pitfall Area 1: Bolting `requireApiKey` Middleware onto Routes with Inconsistent Existing Auth

### Description

The existing codebase has partial, inconsistent auth coverage. Some routes already use the `requireApiKey` middleware (e.g., `GET /models`, `POST /session`). Others like `POST /config`, `GET /config`, and `GET /quota` have no auth at all. `POST /dispatch` has a different pattern: it reads the Bearer token from the header and forwards it to OpenRouter without ever verifying the session belongs to that caller. `PATCH /session/:id/revert` goes through `SessionStore` but skips `requireOwnedSession` entirely — the same ownership helper that is correctly applied to `POST /session/:id/event`.

The trap is that reading route code fast gives the impression each route is either "auth'd" or "not auth'd." The actual risk is subtler: some routes have the API key check but not the ownership check, while others have neither. These two guards are different in kind:
- `requireApiKey` — ensures a Bearer token is present at all. Does not verify the token matches any session.
- `requireOwnedSession` — verifies the token hashes to the same value stored in `SessionRegistry.ownerApiKeyHash`.

### Why It Happens

`requireApiKey` is a middleware function and therefore composable as route-level middleware (`apiRouter.post('/config', requireApiKey, handler)`). `requireOwnedSession` is a helper function called inside the handler body and returns `SessionState | null` — it is not middleware-shaped and cannot be composed the same way. This architectural asymmetry makes it easy to apply one and skip the other. It also means a code reviewer scanning the route definition line will see `requireApiKey` and stop checking, assuming ownership is handled inside.

A second source of confusion: `POST /dispatch` at line 226 accepts a `sessionId` from the request body and an API key from `Authorization: Bearer`, but uses the key only for OpenRouter forwarding (`const apiKey = extractBearerToken(req.headers.authorization) ?? ''`). It does not call `SessionRegistry.isOwnedBy(sessionId, apiKey)`. The session found via `SessionStore.getSession(sessionId)` is the SQLite-persisted session record, which has no `owner_api_key_hash` column — so ownership cannot be checked against SQLite at all without the DEBT-01 migration. Adding `requireApiKey` to `/dispatch` without also adding the ownership check makes the route look fixed while the actual attack path (any caller with a known sessionId consumes another session's quota) remains open.

### Prevention

- Apply both guards in lockstep. For any mutation route, the fix is always: (1) `requireApiKey` at the route definition level AND (2) `requireOwnedSession` or `SessionRegistry.isOwnedBy(sessionId, apiKey)` inside the handler.
- For `POST /config` and read-only endpoints (`GET /config`, `GET /quota`): `requireApiKey` is sufficient since these are not session-scoped.
- For `POST /dispatch` and `PATCH /session/:id/revert`: both guards are required. The ownership check in `/dispatch` must reference `SessionRegistry.isOwnedBy(sessionId, apiKey)`. This requires DEBT-01 (the hydration fix) to be applied first, or simultaneously in the same commit; otherwise `SessionRegistry` will always return null for any session that survived a restart and the ownership check will 404 all legitimate sessions.
- Do not rely on rate limiting as a substitute for auth. `dispatchRateLimiter` is in-memory, resets on restart, and is per-IP/token — it does not enforce session ownership.
- Write the attack path test (TEST-01) before or alongside the fix to confirm the guard actually blocks the attack, not just that the middleware is present. The test for `/dispatch` must: create a session with key A, then attempt dispatch with key B and the same sessionId, and expect 403.

### Phase Warning

SEC-01 (`POST /dispatch` ownership check) has a hard dependency on DEBT-01 (hydration of `SessionRegistry` from SQLite on startup). If SEC-01 is merged before DEBT-01, the ownership check will reject all sessions created before the last restart. Implement in order: DEBT-01 first, then SEC-01.

---

## Pitfall Area 2: Adding `owner_api_key_hash` to the Existing `sessions` Table via SQLite Migration

### Description

The `sessions` table (migration `007_sessions.sql`) has five columns: `id`, `model_id`, `mode`, `created_at`, `last_activity`. Adding `owner_api_key_hash` requires a new migration file (`008_sessions_owner.sql` or similar). The table contains existing rows (any sessions created since `007` was applied). Those rows have no owner hash. How SQLite handles NULL for new columns and how the application handles the NULL on read are the two failure modes.

### Sub-pitfall 2a: Adding `NOT NULL` without a `DEFAULT` on a table with existing rows

SQLite's `ALTER TABLE ... ADD COLUMN` does not support adding a `NOT NULL` column without a `DEFAULT` clause if the table already has rows. The statement will fail at migration time with:

```
error: Cannot add a NOT NULL column with no default value
```

If a `DEFAULT ''` (empty string) is used instead to satisfy the constraint, existing rows get `owner_api_key_hash = ''`. When `SessionRegistry.isOwnedBy(sessionId, apiKey)` is added and the hydration logic reads `owner_api_key_hash` from SQLite, a comparison against `hashApiKey(apiKey)` (a 64-character hex SHA-256) will never match an empty string. The session will appear as unowned and all pre-migration sessions will be permanently inaccessible. This is silently wrong — no error is thrown.

**Prevention:** Use `ALTER TABLE sessions ADD COLUMN owner_api_key_hash TEXT` (nullable, no NOT NULL constraint). Then handle NULL in `SessionStore.getSession()` — a session with a NULL `owner_api_key_hash` should be treated as an expired/legacy session that has no valid owner. The application should not crash on a NULL; it should return 404 or require the user to create a new session. Do not attempt to backfill old rows with a hash because the original API key is unknown at migration time.

### Sub-pitfall 2b: Hydration race condition on startup

The fix for DEBT-01 requires two coordinated changes:
1. Migration adds `owner_api_key_hash` column to `sessions`.
2. On server startup, `runMigrations()` runs, then application code reads all non-expired sessions from `sessions` and calls `SessionRegistry.createSession(...)` for each, using the stored hash.

The current `migrationRunner.ts` runs synchronously via `DatabaseSync` — migrations complete before the server starts accepting requests. This is safe. The hydration step must also run synchronously (or be awaited) before the first route handler can execute.

The risk: if the hydration is placed in a `setTimeout(..., 0)` or in an async startup function that is not awaited, the first few requests after restart will see an empty `SessionRegistry` and return 404 for all owned-session checks. This is not a correctness bug that manifests in testing under a test harness (which clears state between tests) but will surface in production after restart.

**Prevention:** Place hydration in the same synchronous startup block as `runMigrations()`, before `server.listen()`. Pseudocode sequence:

```
runMigrations();
hydrateSessionRegistryFromDb();   // synchronous read of sessions table
server.listen(PORT, () => { ... });
```

The `DatabaseSync` API is synchronous by design — use it. Do not introduce async/await in the startup sequence for this path.

### Sub-pitfall 2c: `SessionStore.createSession` and `SessionRegistry.createSession` called independently, risking divergence

At `api.ts:179-180`, both stores are written on `POST /session`:
```typescript
SessionStore.createSession(sessionId, activeModelId, mode);
SessionRegistry.createSession(sessionId, activeModelId, mode, apiKey);
```

After the migration, `SessionStore.createSession` must also write `owner_api_key_hash` to SQLite. If only `SessionRegistry.createSession` is updated and `SessionStore.createSession` is not, new sessions will be missing the hash in SQLite, the hydration on the next restart will find `owner_api_key_hash = NULL` for them, and they will be treated as unowned after restart.

**Prevention:** Update `SessionStore.createSession` to accept and write `apiKey` (or its pre-hashed form) in the same PR as the migration. The `SessionRegistry.createSession` call is unchanged; only the SQLite-side persistence needs updating. Keep the two stores in sync in the same PR.

### Sub-pitfall 2d: Migration file never runs because the check logic skips it

The `migrationRunner.ts` checks both `migrations` table (by filename) and `schema_version` table (by version number). A new migration with version `008` will only run if neither table has a matching entry. This is correct. The risk is in development: if a developer creates the file, runs the server once (migration applies), then deletes and recreates the file with a different name or different version prefix, the migration runner will try to rerun it (the old name is gone from the check) and will likely fail with a column-already-exists error.

**Prevention:** Once a migration file is named and applied to any persistent database (including the developer's local DB), never rename it. If a mistake is made, add a corrective migration as a new file with the next version number.

---

## Pitfall Area 3: Fixing TypeScript `AbortSignal | undefined` Without Broadening Types

### Description

Two TypeScript errors exist in the dispatch layer:

- `RouterAgent.ts:114` — `TS2552: Cannot find name 'abortSignal'` — a scoping bug where the variable used at the call site is out of scope.
- `councilDispatch.ts:103` — `TS2345: Argument of type 'AbortSignal | undefined' is not assignable to parameter of type 'number | undefined'` — an argument is being passed at the wrong position in a function call.

### Sub-pitfall 3a: Using `as any` or `as AbortSignal` to silence TS2345

The `councilDispatch.ts` error is that `abortSignal` (type `AbortSignal | undefined`) is being passed where a `number | undefined` is expected. The fast fix is a cast: `abortSignal as any`. This compiles, silences the error, and the underlying logic bug (wrong argument position) remains at runtime. The function receiving a `AbortSignal` object where it expects a timeout number will either ignore the value (if the timeout path is optional) or coerce it to `NaN` — neither case throws an error, making the bug invisible.

**Prevention:** Fix the argument order, not the type. Read the full function signature of the called function (likely `AgentOrchestrator.executeGoALite` or a similar function accepting `(plan, query, apiKey, sessionId, abortSignal)` — see `councilDispatch.ts:196`). The `abortSignal` parameter is the fifth positional argument. A type error at position 103 (not 196) means an earlier call site has the arguments in the wrong order. Do not use any type cast to resolve this. The fix is a one-word reorder of the arguments.

### Sub-pitfall 3b: Widening the parameter type to accept `AbortSignal | undefined` everywhere

When `abortSignal` is `undefined` for the MoA path (see `councilDispatch.ts:194` — `executeGoAMoAHybrid` does not receive `abortSignal`), the temptation is to change all downstream function signatures to accept `AbortSignal | undefined` and add a guard at the call site. This is architecturally correct but it means touching `RouterAgent.sampleAgents`, `AgentOrchestrator.executeGoALite`, and their callers — a wider diff than needed for a stabilization fix.

**Prevention:** The narrower fix is to narrow the type before the call, not widen the signature. If `abortSignal` is always defined at the specific call site (it is: `const disconnectController = new AbortController()` is created unconditionally at `api.ts:247` and `disconnectController.signal` is always an `AbortSignal`, not undefined), then pass `disconnectController.signal` directly. The `undefined` type in the interface is there to make `abortSignal` optional in `CouncilDispatchOptions` when the SSE transport doesn't provide one, not to indicate it will ever be missing at the `RouterAgent.sampleAgents(...)` call site.

### Sub-pitfall 3c: Fixing the scoping bug in `RouterAgent.ts:114` by introducing a module-level variable

`TS2552: Cannot find name 'abortSignal'` at line 114 means the code references `abortSignal` as if it were in scope but it isn't. The static `sampleAgents(...)` method receives it as a parameter. The bug is that at line 114, the reference is to a bare `abortSignal` identifier rather than the parameter name. Looking at the method signature and the `fetch` call at line 101 that already uses `signal: abortSignal` correctly (line 114), the error is on a second fetch call or a timeout wrapper deeper in the method that uses the identifier before it was renamed.

**Prevention:** Do not introduce a module-level `let abortSignal: AbortSignal | undefined` to make the name visible. That would suppress the error while silently ignoring the parameter, making abort non-functional. The fix is to pass the parameter through — either add the parameter to the inner function/closure where it is referenced, or move the reference to where the parameter is in scope.

---

## Pitfall Area 4: Session Ownership Check in `POST /dispatch` — Non-Timing-Safe Hash Comparison

### Description

`SessionRegistry.isOwnedBy(sessionId, apiKey)` at `sessionRegistry.ts:49-51` compares `session.ownerApiKeyHash === hashApiKey(apiKey)`. Both sides are 64-character hex strings derived from SHA-256. The comparison uses JavaScript's `===` operator, which is a short-circuit comparison: it stops at the first differing character.

### Sub-pitfall 4a: String comparison is not constant-time

A timing attack on `===` string comparison for API key hashes is not a realistic concern in this threat model. The target is a single-user local application. The attacker would need to be on the same machine, able to issue thousands of timed HTTP requests, and would be attacking SHA-256 hashes rather than the key directly (SHA-256 output is uniformly distributed, so timing differences are negligible). Do not add complexity here that would not be used.

However, there is a different timing issue that is real: the hash computation itself (`crypto.createHash('sha256').update(apiKey).digest('hex')`) happens on every call to `isOwnedBy`. If the API key is very long, this adds non-trivial CPU time on every authenticated request. This is not a security bug but a correctness observation about where the work is being done.

**Prevention for the stabilization milestone:** Use `===` for the hash comparison. This is appropriate for SHA-256 hex-encoded output in a single-user local application. If a future milestone introduces multi-tenant remote deployment, revisit with `crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))` — but that requires `Buffer` objects of equal length. The current implementation is correct for its deployment context.

### Sub-pitfall 4b: Checking the wrong field — `SessionStore` vs `SessionRegistry`

The `POST /dispatch` route currently reads the session from `SessionStore.getSession(sessionId)` (SQLite). `SessionStore.SessionRecord` has no `ownerApiKeyHash` field — it only has `sessionId`, `modelId`, `mode`, `createdAt`, `lastActivity`. If a developer adds the ownership check against the `SessionStore` record before the DEBT-01 migration adds the column, the check silently passes for all sessions (the field is undefined, the hash is a string, `undefined === hashApiKey(...)` is `false`, and the route returns 403 for every request including legitimate ones). This is the most likely concrete integration failure.

**Prevention:** The ownership check must go through `SessionRegistry`, not `SessionStore`. After DEBT-01 is applied, `SessionRegistry` is hydrated from SQLite and can be queried reliably. The check at dispatch should be:

```typescript
const apiKey = extractBearerToken(req.headers.authorization);
if (!apiKey || !SessionRegistry.isOwnedBy(sessionId, apiKey)) {
  return res.status(403).json({ error: 'Forbidden' });
}
```

This must appear after `SessionStore.getSession(sessionId)` confirms the session exists (so that a missing session returns 404, not 403 — the difference matters for client error handling), but before `dispatchCouncilChat` or `dispatchSoloChat` is called.

### Sub-pitfall 4c: `apiKey = extractBearerToken(...) ?? ''` allows empty-string bypass

At `api.ts:239`, the current dispatch code uses:
```typescript
const apiKey = extractBearerToken(req.headers.authorization) ?? '';
```

The `?? ''` fallback means if no Authorization header is present, `apiKey` becomes an empty string rather than `null`. When the ownership check is added using `SessionRegistry.isOwnedBy(sessionId, apiKey)`, an empty-string apiKey will compute `hashApiKey('')` which is a real SHA-256 hash (`'e3b0c44...'`). No session's `ownerApiKeyHash` will ever equal this value (since sessions are always created with a non-empty API key), so the check will return false and the request will be rejected. This is the correct outcome by accident, not by design.

**Prevention:** Change the pattern to an explicit guard:
```typescript
const apiKey = extractBearerToken(req.headers.authorization);
if (!apiKey) {
  return res.status(401).json({ error: 'API key is missing' });
}
```
This makes the auth intent explicit and eliminates the accidental reliance on SHA-256('') never matching a real session hash.

---

## Phase-Specific Warnings

| Fix | Dependency | Failure Mode if Misordered |
|-----|------------|---------------------------|
| SEC-01 (`POST /dispatch` ownership check) | DEBT-01 must land first | `SessionRegistry.isOwnedBy` returns false for all pre-restart sessions → all legitimate sessions get 403 |
| SEC-02 (`PATCH /session/:id/revert` auth) | DEBT-01 should land first | Same as SEC-01: post-restart sessions have no registry entry → 404 on all reverts |
| DEBT-01 hydration | Migration `008` must land first | `SessionStore.getSession` returns rows with NULL `owner_api_key_hash` → hydration writes null into `SessionRegistry` → ownership always fails |
| BUG-02 (`RouterAgent.ts` scoping) | No dependency | Fix only the in-scope reference; do not add module-level state |
| BUG-03 (`councilDispatch.ts` type error) | No dependency | Fix argument order; do not cast |

---

*Pitfalls audit: 2026-06-07*
