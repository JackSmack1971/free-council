<!-- refreshed: 2026-06-08 -->
# Architecture

**Analysis Date:** 2026-06-08

## System Overview

```text
┌──────────────────────────────────────────────────────────────────┐
│                     Next.js Frontend (SPA)                        │
│  `frontend/src/app/page.tsx`  (single-page, all UI state)        │
│  Components: CouncilTrace, AgentProgressPanel, OnboardingModal    │
│  Utility:    apiClient (`frontend/src/utils/api.ts`)             │
│              localDB   (`frontend/src/utils/db.ts`)              │
└────────────────────────────┬─────────────────────────────────────┘
                             │  HTTP + SSE (text/event-stream)
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                   Express Backend (Node.js)                       │
│  Entry:   `backend/src/index.ts`                                  │
│  Routes:  `backend/src/routes/api.ts`   (chat, sessions, config) │
│           `backend/src/routes/upload.ts` (file ingestion)        │
├──────────────────────────────────────────────────────────────────┤
│  DISPATCH LAYER                                                   │
│  `backend/src/dispatch/councilDispatch.ts` — council path        │
│  `backend/src/dispatch/soloDispatch.ts`    — solo path           │
│  `backend/src/dispatch/soloFallback.ts`    — degraded path       │
├──────────────────────────────────────────────────────────────────┤
│  AGENT LAYER                                                      │
│  `backend/src/agents/RouterAgent.ts`       — model selection     │
│  `backend/src/agents/AgentOrchestrator.ts` — GoA/MoA execution  │
│  `backend/src/agents/moa/index.ts`         — aggregator prompt  │
├──────────────────────────────────────────────────────────────────┤
│  MODULES (cross-cutting services)                                 │
│  ModelPoolManager · PreflightGate · SessionStore · SessionRegistry│
│  TelemetryEngine · RetentionMonitor · ConversationStore          │
│  SettingsDeriver · CapabilityDetector · FileProcessor            │
├──────────────────────────────────────────────────────────────────┤
│  DB LAYER                                                         │
│  `backend/src/db/connection.ts`  — SQLite (node:sqlite, WAL)     │
│  `backend/src/db/migrations/`    — versioned SQL migrations       │
│  `backend/src/db/ftsSearchService.ts` — FTS5 document search     │
└──────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  OpenRouter API (external)                                        │
│  https://openrouter.ai/api/v1/chat/completions                   │
│  Free-tier models only (enforced by PreflightGate)               │
└──────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Express server | CORS, JSON parsing, startup, graceful shutdown | `backend/src/index.ts` |
| apiRouter | All REST + SSE endpoints | `backend/src/routes/api.ts` |
| uploadRouter | File ingestion, chunking, FTS indexing | `backend/src/routes/upload.ts` |
| councilDispatch | Orchestrates council mode: routing, preflight, execution, SSE streaming | `backend/src/dispatch/councilDispatch.ts` |
| soloDispatch | Direct single-model SSE streaming | `backend/src/dispatch/soloDispatch.ts` |
| soloFallback | Degraded fallback when council timeouts occur | `backend/src/dispatch/soloFallback.ts` |
| RouterAgent | Selects agent pool for GoA via LLM prompt; determines execution mode | `backend/src/agents/RouterAgent.ts` |
| AgentOrchestrator | Runs GoA-lite, GoA-full, GoA-MoA-hybrid; streams AgentResult yields | `backend/src/agents/AgentOrchestrator.ts` |
| ModelPoolManager | Fetches and caches free model catalog from OpenRouter | `backend/src/modules/modelPoolManager.ts` |
| PreflightGate | Policy enforcement before dispatch (free lock, budget, privacy, ZDR) | `backend/src/modules/preflightGate.ts` |
| SessionStore | Persistent session records in SQLite `sessions` table | `backend/src/modules/sessionStore.ts` |
| SessionRegistry | In-memory session ownership (API key hash → sessionId) | `backend/src/modules/sessionRegistry.ts` |
| TelemetryEngine | Writes structured events to `session_events` table | `backend/src/modules/telemetryEngine.ts` |
| RetentionMonitor | Polls retention rate; demotes council to solo when rate < 50% | `backend/src/modules/retentionMonitor.ts` |
| SessionCleanupMonitor | Periodically removes expired sessions from DB | `backend/src/modules/sessionCleanupMonitor.ts` |
| ConversationStore | Saves/retrieves full message transcript per session | `backend/src/modules/conversationStore.ts` |
| SettingsDeriver | Maps model capabilities to UI control specs | `backend/src/modules/settingsDeriver.ts` |
| FtsSearchService | Full-text search over uploaded file chunks (FTS5) | `backend/src/db/ftsSearchService.ts` |
| shared/index.ts | Shared TypeScript interfaces (AgentPlan, AgentResult, PreflightContext, etc.) | `shared/index.ts` |
| frontend page.tsx | All UI: chat, model selection, routing controls, file upload, presets | `frontend/src/app/page.tsx` |
| apiClient | Frontend HTTP/SSE client wrapper | `frontend/src/utils/api.ts` |
| localDB | Browser IndexedDB wrapper for persisting frontend settings | `frontend/src/utils/db.ts` |

## Pattern Overview

**Overall:** Layered event-driven streaming architecture with multi-agent orchestration (Graph-of-Agents / Mixture-of-Agents) over OpenRouter free-tier models.

**Key Characteristics:**
- All LLM responses stream via SSE (Server-Sent Events) — never buffered as JSON responses
- Two dispatch paths: `council` (multi-agent GoA/MoA) and `solo` (direct single-model)
- Dual session tracking: `SessionStore` (SQLite, durable) + `SessionRegistry` (in-memory, ownership)
- Policy enforcement is centralized in `PreflightGate` before every dispatch
- Council mode falls back to solo automatically on double-timeout or low retention rate

## Layers

**Route Layer:**
- Purpose: HTTP request handling, SSE headers, rate limiting, auth
- Location: `backend/src/routes/`
- Contains: `api.ts`, `upload.ts`
- Depends on: dispatch layer, modules
- Used by: Express server

**Dispatch Layer:**
- Purpose: Orchestrate the full lifecycle of a request (preflight, routing, execution, response assembly)
- Location: `backend/src/dispatch/`
- Contains: `councilDispatch.ts`, `soloDispatch.ts`, `soloFallback.ts`
- Depends on: agent layer, modules, DB
- Used by: route layer

**Agent Layer:**
- Purpose: LLM API calls, parallel execution, scoring, aggregation
- Location: `backend/src/agents/`
- Contains: `RouterAgent.ts`, `AgentOrchestrator.ts`, `moa/index.ts`
- Depends on: modules (TelemetryEngine, ModelPoolManager), OpenRouter API
- Used by: dispatch layer

**Modules Layer:**
- Purpose: Cross-cutting services (state, telemetry, policy, model catalog)
- Location: `backend/src/modules/`
- Contains: ModelPoolManager, PreflightGate, SessionStore, SessionRegistry, TelemetryEngine, RetentionMonitor, ConversationStore, SettingsDeriver, CapabilityDetector, FileProcessor
- Depends on: DB layer, external OpenRouter API (ModelPoolManager)
- Used by: dispatch layer, route layer, agents

**DB Layer:**
- Purpose: SQLite persistence (sessions, events, conversations, uploads, config)
- Location: `backend/src/db/`
- Contains: `connection.ts`, `migrationRunner.ts`, `migrations/*.sql`, `ftsSearchService.ts`, `uploadedFilesRepo.ts`, `policyExceptionsRepo.ts`
- Depends on: `node:sqlite` (built-in Node.js)
- Used by: modules layer

**Shared Types:**
- Purpose: Contracts between backend layers and between frontend and backend
- Location: `shared/index.ts`
- Contains: `AgentPlan`, `AgentResult`, `AgentAssignment`, `PreflightContext`, `GateResult`, `PolicyViolation`, `NormalizedModelCapabilities`, `UIControlSpec`, `SessionEvent`

**Frontend Layer:**
- Purpose: Single-page chat UI with streaming, council progress visualization, settings persistence
- Location: `frontend/src/`
- Contains: `app/page.tsx` (monolith page), `components/`, `utils/`
- Depends on: backend REST/SSE API, IndexedDB (via `localDB`)

## Data Flow

### Council Mode Request Path

1. User submits prompt in `frontend/src/app/page.tsx` → `apiClient.dispatchStream()`
2. `POST /api/v1/dispatch` arrives at `backend/src/routes/api.ts`
3. `SessionStore.getSession()` validates session; `SessionStore.touchSession()` updates activity
4. Route calls `dispatchCouncilChat()` in `backend/src/dispatch/councilDispatch.ts`
5. Prompt classified (simple/complex); routing effort determined (Adaptive/Fast/Balanced/Deep)
6. `RouterAgent.sampleAgents()` calls OpenRouter to select N proposer models → returns `AgentPlan`
7. SSE `plan` event emitted to client
8. `PreflightGate.check()` enforces policy (free lock, budget, privacy, ZDR)
9. FTS5 file chunks injected into prompt if upload present (`FtsSearchService.searchFileContent()`)
10. `AgentOrchestrator.executeGoALite()` or `executeGoAMoAHybrid()` invoked
11. Proposer agents called in parallel via `fetch()` to OpenRouter; results streamed as `AgentResult` yields
12. Edge scoring matrix computed; agents scored and pruned (GoA-lite Balanced/Deep)
13. Primary agent selected (max-pool or MoA aggregator synthesis)
14. SSE events emitted: `agent_start`, `agent_done`, `s_scores`, `pruned`, `selected`, `response`, `trace`
15. `TelemetryEngine.record()` writes `routed_to_council` and `completed_in_council` events to SQLite
16. `ConversationStore.saveConversation()` persists transcript to `conversations` table

### Solo Mode Request Path

1. Same entry as council through `POST /api/v1/dispatch`
2. `PreflightGate.check()` runs for single model
3. `dispatchSoloChat()` in `backend/src/dispatch/soloDispatch.ts`
4. Direct streaming `fetch()` to OpenRouter; SSE chunks forwarded to client
5. Transcript saved to `ConversationStore` on complete

### Retention Monitor Cycle

1. `RetentionMonitor` polls every 60 seconds
2. Queries `routed_to_council` / `completed_in_council` event counts from `session_events`
3. If rate < 50% with sample >= 5: writes `default_mode = 'solo'` and `demoted_by_retention = 'true'` to `app_config`
4. Frontend polls `GET /config` every 10 seconds and displays rollback banner

**State Management:**
- Frontend: React `useState` hooks (all local to `page.tsx`); non-sensitive settings persisted via `localDB` (IndexedDB)
- Backend: Module-level singletons for `SessionRegistry` (Map) and proposer cache in `AgentOrchestrator`; durable state in SQLite

## Key Abstractions

**AgentPlan:**
- Purpose: Contract describing which models to call, execution mode, budget, and MoA config
- Examples: produced by `RouterAgent.sampleAgents()`, consumed by `AgentOrchestrator`
- Pattern: Passed as a value object through the dispatch layer

**AgentResult:**
- Purpose: Output from a single agent call — includes response, sScore, status, fallback flags
- Examples: yielded from all three `AgentOrchestrator` methods
- Pattern: AsyncIterableIterator yields; collected and translated to SSE events

**PreflightContext / GateResult:**
- Purpose: Encapsulates all policy inputs; `PreflightGate.check()` returns a `GateResult`
- Examples: `backend/src/modules/preflightGate.ts`, `shared/index.ts`
- Pattern: Checked at both route level (solo) and dispatch level (council) before any LLM call

**SessionRegistry (in-memory) vs SessionStore (SQLite):**
- `SessionRegistry`: ownership map (API key hash → sessionIds); lives only in memory; lost on restart
- `SessionStore`: durable session record (mode, model, timestamps); survives restarts
- Both are required for a complete session operation

## Entry Points

**Backend HTTP Server:**
- Location: `backend/src/index.ts`
- Triggers: `node` / `tsx` process start
- Responsibilities: Runs migrations, refreshes model pool, starts Express, starts background monitors

**Primary API Router:**
- Location: `backend/src/routes/api.ts`
- Triggers: Express mount at `/api/v1` and `/` (fallback)
- Responsibilities: Session CRUD, model listing, dispatch routing, quota, config, telemetry events, schema validation

**Upload Router:**
- Location: `backend/src/routes/upload.ts`
- Triggers: Express mount at `/api/v1/upload` and `/upload` (fallback)
- Responsibilities: File chunking, FTS5 indexing, upload disclosure enforcement

**Frontend Root:**
- Location: `frontend/src/app/page.tsx`
- Triggers: Next.js page render
- Responsibilities: All UI rendering and state management; directly dispatches API calls via `apiClient`

## Architectural Constraints

- **Threading:** Node.js single-threaded event loop. All DB calls use `node:sqlite` synchronous API (blocking). Async `fetch()` calls to OpenRouter are non-blocking.
- **Global state:** `SessionRegistry` is a module-level `Map` in `backend/src/modules/sessionRegistry.ts`. Proposer response cache is a module-level `Map` in `backend/src/agents/AgentOrchestrator.ts`. Both are lost on process restart.
- **Dual session stores:** Every session must be created in both `SessionStore` (SQLite) and `SessionRegistry` (in-memory). Only `SessionRegistry` enforces ownership. This split is a known architectural risk.
- **Frontend monolith:** All UI logic lives in `frontend/src/app/page.tsx` (~2000 lines). No component-level state management library.
- **Circular imports:** None detected, but `dispatch/` imports from `agents/` and `modules/` which import from `db/`. Keep this order: `db → modules → agents → dispatch → routes`.

## Anti-Patterns

### Dual-Store Session Split

**What happens:** `POST /session` writes to both `SessionStore.createSession()` and `SessionRegistry.createSession()`. Ownership lives only in `SessionRegistry`.
**Why it's wrong:** Process restart or horizontal scaling loses `SessionRegistry`, making ownership checks fail for existing sessions.
**Do this instead:** Persist ownership (hashed API key) to the `sessions` SQLite table and remove `SessionRegistry`'s role as the source of truth for ownership. See `backend/src/modules/sessionStore.ts` and `backend/src/modules/sessionRegistry.ts`.

### Frontend God Component

**What happens:** `frontend/src/app/page.tsx` contains all UI state, all handlers, all rendering (~2000 lines).
**Why it's wrong:** Any modification risks unintended side effects; component reuse is impossible; testing is impractical.
**Do this instead:** Extract feature-area state and handlers into custom hooks (e.g., `useSession`, `useDispatch`, `useSettings`) and split rendering into sub-components.

## Error Handling

**Strategy:** Errors in the dispatch layer write an SSE `error` frame before calling `onError()`. Route handlers respond with `{ error: string }` JSON for non-streaming errors.

**Patterns:**
- SSE streams: `writeSseErrorFrame()` helper in `backend/src/routes/api.ts` writes `{ type: 'error', message, partial }` frame
- Double timeout in `AgentOrchestrator`: falls back to `executeSoloFallback()` with `'double_timeout'` rationale
- Aggregator failure: falls back to best proposer response with appended notice
- PreflightGate violation: returns HTTP 400/401 for non-streaming; SSE error frame + `onError()` for streaming
- Generic internal errors use sanitized messages (`GENERIC_REQUEST_ERROR`) to avoid leaking stack traces

## Cross-Cutting Concerns

**Logging:** `console.log/warn/error` with `[Component]` prefix tags (e.g., `[AgentOrchestrator]`, `[RetentionMonitor]`). Configured via `backend/src/config/logger.ts`.
**Validation:** Input validated at route level via inline checks and `validateJsonSchema()` helper in `backend/src/routes/api.ts`. No external validation library.
**Authentication:** Bearer token (`Authorization: Bearer <key>`) passed through to OpenRouter. Ownership enforced via SHA-256 hash stored in `SessionRegistry`. No user auth system.

---

*Architecture analysis: 2026-06-08*
