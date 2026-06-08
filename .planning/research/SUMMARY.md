# Project Research Summary

**Project:** FreeCouncil v1.0 Stabilization
**Researched:** 2026-06-07
**Confidence:** HIGH

## Executive Summary

FreeCouncil v1.0 Stabilization is a targeted hardening milestone with zero new features. The codebase has a clean architectural foundation (Express 4 + node:sqlite + TypeScript strict mode + NodeNext modules) but three concrete defects block safe operation: the TypeScript build is broken (three errors in upload.ts, RouterAgent.ts, and councilDispatch.ts), five mutation/read endpoints accept unauthenticated requests (SEC-01 through SEC-04), and session ownership is stored only in an in-memory Map that clears on every restart (DEBT-01). All research was derived from direct code inspection; confidence is HIGH across all four areas.

The recommended approach is sequential: fix TypeScript errors first (unblocks testing), then add the SQLite owner_api_key_hash column and migrate SessionStore to own the ownership check (DEBT-01), then wire auth middleware against the now-persistent ownership data (SEC-01 through SEC-04). This order is a hard dependency: applying the SEC fixes before DEBT-01 leaves a window where all pre-restart sessions return 403 instead of being recognized as owned.

The three principal risks are: (1) the NOT NULL trap - SQLite ALTER TABLE ADD COLUMN NOT NULL without a DEFAULT fails if the table has existing rows; use nullable TEXT and treat NULL as unowned; (2) the SEC-01/DEBT-01 coupling - adding an ownership check to /dispatch before owner_api_key_hash is persisted causes legitimate sessions to fail after restart; (3) BUG-03 is a positional argument error - silencing it with a type cast leaves an AbortSignal object arriving where a number is expected, producing NaN timeout silently at runtime.

---

## Key Findings

### Recommended Stack (from STACK.md)

All fixes use only existing dependencies and Node.js built-ins. No new npm packages are required.

**Core technologies involved:**

- **TypeScript 5.x, strict mode, NodeNext modules**: All local imports require .js extension. AbortController/AbortSignal are global built-ins in Node 22. AbortSignal.timeout(ms) available in Node 17.3+.
- **Express 4.19.2**: requireApiKey currently types next as a no-arg void function; must change to NextFunction from express when wiring as route middleware.
- **node:sqlite (Node 22.5+), DatabaseSync**: All DB operations are synchronous. ALTER TABLE ADD COLUMN is supported. Migration runner applies .sql files lexicographically - 008_session_owner_hash.sql is sufficient, no migrationRunner.ts changes needed.
- **node:crypto**: hashApiKey already exported from sessionRegistry.ts. Import into sessionStore.ts (same modules layer, safe) or inline to eliminate future circular risk.

### Expected Features (from FEATURES.md)

**Must do (table stakes this milestone):**

- Apply requireApiKey to POST /dispatch, PATCH /session/:id/revert, POST /config, GET /config, GET /quota
- Add SessionStore.isOwnedBy ownership check to POST /dispatch and PATCH /session/:id/revert
- Add default_mode enum validation (solo or council) to POST /config
- Add migration 008_session_owner_hash.sql: ALTER TABLE sessions ADD COLUMN owner_api_key_hash TEXT
- Update SessionStore.createSession() to accept and persist apiKey as SHA-256 hash
- Update SessionRecord interface: ownerApiKeyHash: string | null
- Update requireOwnedSession to read from SessionStore instead of SessionRegistry
- Fix BUG-01: add missing createRateLimitMiddleware import in upload.ts
- Fix BUG-02: replace bare abortSignal reference with AbortSignal.timeout(timeoutMs) in RouterAgent.sampleAgents()
- Fix BUG-03: remove trailing abortSignal argument from sampleAgents call in councilDispatch.ts:103

**Should do (correctness, same milestone):**

- Push GET /sessions ownership filter into SQL (WHERE owner_api_key_hash = ?) removing SessionRegistry.listOwnedSessionIds
- Replace extractBearerToken() null-coalescing empty-string fallback with explicit null guard in POST /dispatch

**Defer to post-stabilization:**

- Full SessionRegistry module removal (file [DEAD] issue - redundant after Phase 2/3 but full removal is separate scope)
- crypto.timingSafeEqual for hash comparison (single-user local threat model does not require it)
- Structured ownership error codes mirroring violationType pattern
- SEC-05 console audit for API key leakage in dispatch logs

**Anti-features (do not build):**

- OpenRouter key validation round-trip on every request (latency + quota burn)
- JWT, OAuth, session cookies, or multi-user isolation
- ORM or query builder
- bcrypt/argon2 for API key hashing (incompatible with synchronous node:sqlite; SHA-256 sufficient for high-entropy keys)

### Architecture Approach (from ARCHITECTURE.md)

The stabilization touches four layers but introduces no new cross-layer dependencies. The import order (db -> modules -> agents -> dispatch -> routes) is respected throughout. The key architectural move is collapsing the Dual-Store Session Split anti-pattern: SessionStore (SQLite) becomes the single source of truth for session ownership (Strategy B), eliminating the restart vulnerability without adding a startup hydration phase. SessionRegistry ownership methods become thin wrappers or no-ops.

**Components changed:**

1. 008_session_owner_hash.sql (NEW) - ALTER TABLE sessions ADD COLUMN owner_api_key_hash TEXT
2. sessionStore.ts (MODIFIED) - SessionRecord/SessionRow gain ownerApiKeyHash; createSession accepts apiKey; new isOwnedBy() method
3. sessionRegistry.ts (MODIFIED) - ownership methods become SessionStore wrappers; hashApiKey/extractBearerToken remain here
4. api.ts (MODIFIED) - requireApiKey on 3 endpoints; ownership check inline in /dispatch; requireOwnedSession updated to read from SessionStore and added to /revert
5. upload.ts (MODIFIED) - one import line added
6. RouterAgent.ts (MODIFIED) - AbortSignal.timeout(timeoutMs) replaces bare abortSignal reference
7. councilDispatch.ts (MODIFIED) - trailing abortSignal argument removed from sampleAgents call
8. index.ts (NO CHANGE - Strategy B requires no startup hydration)

### Critical Pitfalls (from PITFALLS.md)

1. **NOT NULL trap on migration** - ALTER TABLE sessions ADD COLUMN TEXT NOT NULL fails if existing rows are present. Use TEXT (nullable, no NOT NULL constraint). Do not use DEFAULT empty-string - empty-string hashes never match a real key hash, making pre-migration sessions permanently 403. Treat NULL as unowned at the application level.

2. **SEC-01/DEBT-01 coupling** - Adding the dispatch ownership check before owner_api_key_hash is persisted means all pre-restart sessions fail (registry empty after restart, isOwnedBy returns false, 403 on every dispatch). DEBT-01 must land in the same commit as or before SEC-01/SEC-02.

3. **BUG-03 is positional, not a type cast** - councilDispatch.ts:103 passes abortSignal (AbortSignal|undefined) as the 10th arg where timeoutMs:number is expected. Fix by removing the argument from the call site (let timeoutMs use its default). Do not silence with a type cast - that delivers an AbortSignal to the timeout slot at runtime, producing NaN timeout invisibly.

4. **Double requireApiKey on dispatch** - Do not add requireApiKey as Express middleware to POST /dispatch. Add the ownership check inline after session lookup, reusing the already-extracted apiKey. Avoids a second extractBearerToken call.

5. **requireApiKey next() type mismatch** - The existing local requireApiKey types next as a no-arg void function. Change to NextFunction from express when wiring as route middleware to avoid a latent TypeScript error surfacing in CI.

---

## Implications for Roadmap

### Phase 1: TypeScript Build Restoration (BUG-01, BUG-02, BUG-03)

**Rationale:** All three TypeScript errors are independent of auth and persistence work. Fixing them first restores tsc --noEmit to a clean exit, unblocking the test suite and providing a compile-check gate for subsequent phases.

**Delivers:** Clean TypeScript build; upload rate limiter restored to functional; abort signal handling correct in dispatch layer.

**Addresses:** BUG-01, BUG-02, BUG-03

**Avoids:** Do not silence BUG-03 with a type cast (positional fix required); do not introduce module-level abortSignal state in RouterAgent.

**Files:** upload.ts, RouterAgent.ts, councilDispatch.ts

**Research flag:** No deeper research needed. All three fixes are 1-3 line changes with HIGH confidence root cause from direct inspection.

---

### Phase 2: Session Ownership Persistence (DEBT-01)

**Rationale:** The SEC-01/SEC-02 ownership checks read from SessionRegistry, which empties on any process restart. Until owner_api_key_hash is persisted in SQLite and requireOwnedSession reads from SessionStore, any auth gate on session-scoped routes breaks legitimate sessions after restart. DEBT-01 is a hard prerequisite for SEC-01 and SEC-02.

**Delivers:** Session ownership survives process restarts; SessionStore is the single source of truth; SessionRegistry ownership methods become thin wrappers.

**Addresses:** DEBT-01

**Avoids:** NOT NULL trap (use nullable TEXT column, no DEFAULT); SessionStore/SessionRegistry divergence (update both createSession call sites in same commit).

**Files:** 008_session_owner_hash.sql (new), sessionStore.ts, sessionRegistry.ts

**Research flag:** No deeper research needed. Migration pattern matches existing 007_sessions.sql. All changes are mechanical schema and interface extensions.

---

### Phase 3: Auth Middleware Wiring (SEC-01, SEC-02, SEC-03, SEC-04)

**Rationale:** With DEBT-01 complete, SessionStore.isOwnedBy() is ready and persistence-backed. All five unguarded routes can now be protected correctly.

**Delivers:** All five routes gated - POST /dispatch (ownership check), PATCH /session/:id/revert (ownership check), POST /config (requireApiKey + enum validation), GET /config (requireApiKey), GET /quota (requireApiKey).

**Addresses:** SEC-01, SEC-02, SEC-03, SEC-04

**Avoids:** Double requireApiKey on dispatch (inline check only); next() type mismatch (fix to NextFunction when wiring); empty-string bypass (explicit null guard replaces null-coalescing fallback).

**Files:** api.ts only

**Research flag:** No deeper research needed. All changes are additive. POST /dispatch integration point precisely identified (after SessionStore.touchSession(), before dispatch call).

---

### Phase Ordering Rationale

- Phase 1 before Phase 2: TypeScript errors prevent clean tsc build; restoring the build enables compile verification of later phases
- Phase 2 before Phase 3: Hard data dependency - SEC-01/SEC-02 are only correct after owner_api_key_hash is persisted; wrong order causes 403 on all legitimate post-restart sessions
- Phase 3 isolated to api.ts: no schema changes, no new methods, lowest blast radius

### Research Flags

All three phases use standard, well-documented patterns already present in the codebase. No phase requires additional pre-planning research before implementation.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Direct code inspection; no new packages required; Node 22 + TS 5.x confirmed |
| Features | HIGH | All route gaps confirmed by reading api.ts; no training-data assertions |
| Architecture | HIGH | Import order confirmed from PROJECT.md; Strategy B safe per current import graph |
| Pitfalls | HIGH | All pitfalls from actual code (api.ts:239 fallback, SQLite NOT NULL behavior, councilDispatch.ts:103 positional bug) |

**Overall confidence:** HIGH

### Gaps to Address

- **SEC-04 payload review**: Verify GET /config and GET /quota response bodies do not expose sensitive data before closing SEC-04.
- **TEST-01/TEST-02**: No integration tests for auth paths exist. Write alongside fixes or file [TEST] issue if deferred.
- **SessionRegistry removal**: File [DEAD] issue after Phase 2/3 for follow-on cleanup of now-redundant module.

---

## Sources

### Primary (HIGH confidence)

- Direct code inspection: backend/src/routes/api.ts, backend/src/routes/upload.ts, backend/src/agents/RouterAgent.ts, backend/src/dispatch/councilDispatch.ts, backend/src/modules/sessionRegistry.ts, backend/src/modules/sessionStore.ts, backend/src/db/connection.ts, backend/src/db/migrations/007_sessions.sql, backend/src/middleware/rateLimit.ts
- Context7 Node.js docs (/nodejs/node): DatabaseSync, StatementSync.get/all/run, AbortSignal.timeout - HIGH confidence
- Context7 TypeScript docs (/microsoft/typescript-website): type narrowing, union types, strict mode - HIGH confidence
- .planning/PROJECT.md: import order constraint, API key storage constraint, budget constraint

---
*Research completed: 2026-06-07*
*Ready for roadmap: yes*
