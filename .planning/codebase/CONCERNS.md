# Codebase Concerns

**Analysis Date:** 2026-06-08

---

## Known Bugs

**Missing import: `createRateLimitMiddleware` in `upload.ts`:**
- Symptoms: `src/routes/upload.ts` calls `createRateLimitMiddleware` at line 10 but the function is never imported. TypeScript reports `error TS2304: Cannot find name 'createRateLimitMiddleware'`. The upload rate limiter is silently undefined, so the middleware is non-functional at runtime — any request bypasses the upload rate limit.
- Files: `backend/src/routes/upload.ts:10`
- Trigger: Any file upload request. The rate limit middleware is skipped entirely.
- Workaround: None.

**TypeScript compile errors (build broken):**
- Symptoms: `npx tsc --noEmit` produces at least 3 errors in production source files beyond test files:
  1. `backend/src/routes/upload.ts:10` — `TS2304: Cannot find name 'createRateLimitMiddleware'`
  2. `backend/src/agents/RouterAgent.ts:114` — `TS2552: Cannot find name 'abortSignal'` (likely a scoping bug — should be a parameter reference not a global)
  3. `backend/src/dispatch/councilDispatch.ts:103` — `TS2345: AbortSignal | undefined` passed where `number | undefined` is expected (wrong argument position in a `setTimeout`-like call)
- Files: `backend/src/routes/upload.ts`, `backend/src/agents/RouterAgent.ts`, `backend/src/dispatch/councilDispatch.ts`
- Trigger: TypeScript compilation.
- Workaround: Tests run via ts-node/vitest which may skip strict type checking.

---

## Security Considerations

**`PATCH /session/:id/revert` is unauthenticated:**
- Risk: Any caller who knows a valid `sessionId` (a UUID) can flip that session from council to solo mode and inject a telemetry event. No API key or ownership check is applied.
- Files: `backend/src/routes/api.ts:508-531`
- Current mitigation: None. Session IDs are crypto.randomUUID() so guessing is hard but not impossible under enumeration.
- Recommendations: Apply `requireOwnedSession` check, consistent with `GET /session/:id/messages` and `POST /session/:id/event`.

**`POST /dispatch` does not verify session ownership:**
- Risk: A caller can pass any `sessionId` from `SessionStore` (SQLite-persisted) without presenting a matching Bearer token. The route reads `authorization` header only to pass the API key to OpenRouter — it does not verify the session belongs to the caller. An attacker who learns a session ID can consume another user's session quota.
- Files: `backend/src/routes/api.ts:226-337`
- Current mitigation: Rate limiting per token/IP via `dispatchRateLimiter`. `SessionRegistry` ownership is checked in `requireOwnedSession` for other routes but not here.
- Recommendations: Call `requireOwnedSession` or at minimum `SessionRegistry.isOwnedBy(sessionId, apiKey)` before executing dispatch.

**`POST /config` is unauthenticated and unvalidated:**
- Risk: Any caller can overwrite `default_mode`, `council_reevaluated_after_ts`, and `demoted_by_retention` in `app_config`. This can silently demote or promote all users between council and solo mode.
- Files: `backend/src/routes/api.ts:608-625`
- Current mitigation: None. No authentication middleware, no input validation beyond field presence.
- Recommendations: Gate behind `requireApiKey`. Validate `default_mode` is `solo|council`. Consider removing this endpoint from the public API surface.

**`GET /config` and `GET /quota` are unauthenticated:**
- Risk: Internal configuration values and quota metrics are publicly readable without credentials.
- Files: `backend/src/routes/api.ts:450-475`, `555-567`
- Current mitigation: None.
- Recommendations: Apply `requireApiKey` middleware.

**API key transmitted in-memory without scope binding:**
- Risk: `SessionRegistry` stores an SHA-256 hash of the API key alongside session state. The raw API key travels in every `Authorization: Bearer` header and is forwarded unmodified to OpenRouter. If any log statement inadvertently captures the full request headers, the key leaks.
- Files: `backend/src/modules/sessionRegistry.ts`, `backend/src/agents/AgentOrchestrator.ts:96`
- Current mitigation: Key is never logged directly. SHA-256 hash stored in `SessionRegistry`.
- Recommendations: Audit all `console.*` calls in dispatch paths to confirm header contents are not captured.

**In-memory rate limiter resets on process restart:**
- Risk: `backend/src/middleware/rateLimit.ts` stores all rate limit counters in module-level `Map` instances. A process restart (crash, deploy) clears all counters, allowing a burst of requests to bypass window limits.
- Files: `backend/src/middleware/rateLimit.ts:14`
- Current mitigation: None.
- Recommendations: Persist counters to SQLite between restarts, or accept and document this limitation.

**`/dispatch` body size not limited:**
- Risk: `app.use(express.json())` in `backend/src/index.ts:19` uses Express's default body size limit (100kb). A large `messages` array with long conversation histories could exceed this and silently be rejected, or if the default is raised, could enable a denial of service via large payloads.
- Files: `backend/src/index.ts:19`
- Current mitigation: Express default 100kb limit applies.
- Recommendations: Set an explicit limit: `express.json({ limit: '512kb' })` and document the constraint.

---

## Tech Debt

**Dual session stores with diverging lifetimes:**
- Issue: Session data is split across two independent stores. `SessionStore` (SQLite, `backend/src/modules/sessionStore.ts`) persists sessions across restarts with a 24-hour TTL. `SessionRegistry` (in-memory Map, `backend/src/modules/sessionRegistry.ts`) holds ownership/auth data and is lost on restart. After a restart, `SessionStore.getSession()` returns data but `SessionRegistry.getSession()` returns null, breaking auth on the `dispatch` and `upload` routes for all pre-restart sessions.
- Files: `backend/src/modules/sessionStore.ts`, `backend/src/modules/sessionRegistry.ts`, `backend/src/routes/api.ts:179-181`
- Impact: After any process restart, all existing sessions lose their ownership record. Users get 404 or Forbidden errors until they create new sessions.
- Fix approach: Either (a) eliminate `SessionRegistry` and derive ownership from a `owner_api_key_hash` column added to the `sessions` table, or (b) on startup, hydrate `SessionRegistry` from the `sessions` table.

**`model_snapshots` table grows unboundedly:**
- Issue: `ModelPoolManager.refresh()` inserts a new row into `model_snapshots` on every successful refresh (hourly). There is no DELETE or TRUNCATE logic anywhere in the codebase. Over months, this table will accumulate thousands of large JSON blobs (models list + card summaries).
- Files: `backend/src/modules/modelPoolManager.ts:35-44`
- Impact: SQLite file size grows without bound. Reads remain fast (always `LIMIT 1`), but disk usage and WAL checkpoint times increase.
- Fix approach: After inserting a new snapshot, delete all but the last N rows: `DELETE FROM model_snapshots WHERE snapshot_ts NOT IN (SELECT snapshot_ts FROM model_snapshots ORDER BY snapshot_ts DESC LIMIT 5)`.

**`session_events` table has no retention policy:**
- Issue: Telemetry rows are written for every request, retry, and system event. `SessionCleanupMonitor` deletes expired `sessions` rows but does not cascade to `session_events`. The `session_events` table accumulates permanently.
- Files: `backend/src/modules/sessionCleanupMonitor.ts`, `backend/src/modules/telemetryEngine.ts`
- Impact: Unbounded table growth. `queryModelPerformance` scans up to 500 rows but `queryCouncilRetentionRate` does a full table scan with a `WHERE ts > ?` filter — performance degrades as the table grows.
- Fix approach: Add a purge step to `SessionCleanupMonitor.runOnce()` that deletes `session_events` rows older than `SESSION_TTL_MS`.

**`conversations` table `GET /sessions` has no LIMIT:**
- Issue: `SELECT id, ts FROM conversations ORDER BY ts DESC` at `backend/src/routes/api.ts:497` has no LIMIT clause. The result set is filtered in JavaScript by session ownership. For long-running deployments this will load all conversations into memory on every call.
- Files: `backend/src/routes/api.ts:497`
- Impact: Memory pressure and slow responses as conversation count grows.
- Fix approach: Push the ownership filter into SQL using a `owner_api_key_hash` column, and add a LIMIT clause.

**`frontend/src/app/page.tsx` is a god component (1971 lines):**
- Issue: The entire frontend application lives in a single React component: all state (30+ useState hooks), all effects, all handlers, all rendering. There is no component decomposition below the top-level `Home` export except for the three imported components (`CouncilTrace`, `AgentProgressPanel`, `OnboardingModal`).
- Files: `frontend/src/app/page.tsx`
- Impact: Difficult to test, slow to develop, high risk of state interaction bugs, and React renders the entire tree on every state change.
- Fix approach: Extract logical groupings into sub-components (e.g., chat input area, session controls, model selector, quota display) with localized state.

**Inline schema validation duplicated in `api.ts` and `soloDispatch.ts`:**
- Issue: `validateJsonSchema` is defined as a local function in `backend/src/routes/api.ts:22-66` and a nearly identical `check` function exists in `backend/src/dispatch/soloDispatch.ts:194-216`. They share the same logic but are not unified.
- Files: `backend/src/routes/api.ts:22-66`, `backend/src/dispatch/soloDispatch.ts:185-221`
- Impact: Bug fixes or schema validation improvements must be applied in two places.
- Fix approach: Extract into `shared/` or a `backend/src/utils/validateJsonSchema.ts` module.

**`DEFAULT_MODELS` hardcoded list in `api.ts`:**
- Issue: A list of 12 model IDs is hardcoded in `backend/src/routes/api.ts:80-93`. This list is used to compute `unavailableModels` in the `/models` response. When OpenRouter changes model IDs or deprecates models, this list silently becomes stale.
- Files: `backend/src/routes/api.ts:80-93`
- Impact: `unavailableModels` response becomes inaccurate, confusing frontend users.
- Fix approach: Drive this list from a config file or environment variable.

**Token estimation in `limitContext` is a rough approximation:**
- Issue: `limitContext` in `backend/src/dispatch/soloDispatch.ts:18-48` estimates token count as `contextLimit * 4` characters, then measures message length using `JSON.stringify(msg).length`. This counts JSON overhead (quotes, braces, key names) as tokens, systematically underestimating context length.
- Files: `backend/src/dispatch/soloDispatch.ts:18-48`
- Impact: Context windows may be trimmed more aggressively than necessary, or in edge cases pass more tokens than the model supports.
- Fix approach: Use a proper tokenizer (e.g., `tiktoken`) or at minimum strip JSON wrapper overhead from character counts.

---

## Performance Bottlenecks

**`queryCouncilRetentionRate` full-table scan on `session_events`:**
- Problem: Called every 60 seconds by `RetentionMonitor`. The query `SELECT SUM(...) FROM session_events WHERE ts > ?` scans all rows newer than `minTs`. As event count grows, this scan gets slower.
- Files: `backend/src/modules/retentionMonitor.ts:22-28`, `backend/src/modules/telemetryEngine.ts:65-71`
- Cause: No composite index on `(ts, event_type)`. Existing index `idx_session_events_type_ts` may not be used for this query shape.
- Improvement path: Add `CREATE INDEX IF NOT EXISTS idx_session_events_ts ON session_events (ts)` and verify query plan uses it.

**`ModelPoolManager.refresh()` called by both `ProviderHealthMonitor` and startup:**
- Problem: `ProviderHealthMonitor` (10-minute interval) calls `ModelPoolManager.refresh()` which issues a fetch to `https://openrouter.ai/api/v1/models` and does a SQLite INSERT. This runs concurrently with in-flight requests. SQLite is single-writer; if a request is mid-write, the refresh INSERT blocks on `busy_timeout = 5000ms`.
- Files: `backend/src/modules/providerHealthMonitor.ts:21`, `backend/src/modules/modelPoolManager.ts:13`
- Cause: No write queue or throttling between background refresh and request-time writes.
- Improvement path: Decouple the refresh snapshot write from the in-memory model pool update. Write snapshots only when the model set actually changes.

---

## Fragile Areas

**`SessionRegistry` in-memory Map (no persistence):**
- Files: `backend/src/modules/sessionRegistry.ts:10`
- Why fragile: Lost on every process restart. See "Dual session stores" tech debt entry above. Any deployment, crash, or `nodemon` restart invalidates all active sessions.
- Safe modification: Do not add any logic that depends on `SessionRegistry` having persistent state across restarts without first fixing the persistence gap.
- Test coverage: `sessionRegistry.ts` has no test file.

**Custom multipart parser in `upload.ts`:**
- Files: `backend/src/routes/upload.ts:25-74`
- Why fragile: A hand-rolled multipart boundary parser replaces a battle-tested library (multer, busboy). It handles only the happy path: single `file` field, UTF-8 headers, standard CRLF line endings. Malformed boundaries, multipart files with unusual encodings, or missing CRLF before first boundary are not handled.
- Safe modification: Any change to the multipart parsing logic should be preceded by adding boundary edge-case tests. Consider replacing with `busboy` or `formidable`.
- Test coverage: `upload.test.ts` exists but tests the happy path; boundary edge cases are not covered.

**`AgentOrchestrator` proposer cache keyed on a weak hash:**
- Files: `backend/src/agents/AgentOrchestrator.ts:12-17`
- Why fragile: The cache key is `"${modelId}|${length}:${first100chars}:${last100chars}"`. Two prompts of equal length with the same first and last 100 characters but different middle content will collide and return a stale cached response. This is a correctness bug that surfaces for long, similar prompts (e.g., iterative refinement within a session).
- Safe modification: Replace the hash with a proper content hash (e.g., `crypto.createHash('sha256').update(prompt).digest('hex')`).
- Test coverage: Cache key collision not tested.

**`ProviderHealthMonitor` has no stop handle returned to caller:**
- Files: `backend/src/modules/providerHealthMonitor.ts`, `backend/src/index.ts`
- Why fragile: `ProviderHealthMonitor.start()` does not return the interval handle and is not wired into `gracefulShutdown`. On SIGTERM the interval fires one final time after the server closes, potentially causing a SQLite write-after-close error.
- Safe modification: Add `ProviderHealthMonitor` to the graceful shutdown sequence in `backend/src/server/gracefulShutdown.ts`.
- Test coverage: No test file for `providerHealthMonitor.ts`.

---

## Test Coverage Gaps

**`sessionRegistry.ts` — no tests:**
- What's not tested: `createSession`, `listOwnedSessionIds`, `isOwnedBy`, `updateMode`, hash collision behavior, clearForTests idempotency.
- Files: `backend/src/modules/sessionRegistry.ts`
- Risk: Ownership logic is security-critical; bugs here would allow session hijacking.
- Priority: High

**`modelCardSummarizer.ts` — no tests:**
- What's not tested: `summarize()` normalization logic, capability flag derivation, edge cases for models missing description fields.
- Files: `backend/src/modules/modelCardSummarizer.ts`
- Risk: Bad summaries degrade RouterAgent prompt quality without visible error.
- Priority: Medium

**`providerHealthMonitor.ts` — no tests:**
- What's not tested: model removed/restored event emission, listener registration, start/stop lifecycle.
- Files: `backend/src/modules/providerHealthMonitor.ts`
- Risk: Silent failures in change detection.
- Priority: Medium

**`sessionCleanupMonitor.ts` — no tests:**
- What's not tested: `runOnce()` deletion count, interval scheduling, TTL parameter forwarding.
- Files: `backend/src/modules/sessionCleanupMonitor.ts`
- Risk: Expired sessions accumulate silently.
- Priority: Low

**Frontend `page.tsx` — no tests:**
- What's not tested: All interaction handlers, streaming parsing, session lifecycle, error recovery flows.
- Files: `frontend/src/app/page.tsx`
- Risk: UI regressions are invisible to CI.
- Priority: Medium

**Unauthenticated route attack paths — no integration tests:**
- What's not tested: `POST /config` without credentials, `PATCH /session/:id/revert` by a non-owner, `POST /dispatch` with a stolen session ID.
- Files: `backend/src/routes/api.ts`
- Risk: Auth gaps go undetected.
- Priority: High

---

## Dependencies at Risk

**`node:sqlite` (Node.js built-in experimental API):**
- Risk: `DatabaseSync` from `node:sqlite` is used throughout the backend (`backend/src/db/connection.ts:1`). This API was added in Node.js 22.5 and is marked as experimental. Breaking changes are possible in future Node.js releases without a semver major bump.
- Impact: Any Node.js upgrade could break all database operations silently.
- Migration plan: Monitor Node.js changelog for `node:sqlite` stability status. Consider wrapping `DatabaseSync` behind a thin adapter interface to ease future migration to `better-sqlite3` if the API changes.

---

*Concerns audit: 2026-06-08*
