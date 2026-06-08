# Codebase Structure

**Analysis Date:** 2026-06-08

## Directory Layout

```
free-council/                      # Repository root
├── backend/                       # Node.js/Express API server (TypeScript)
│   ├── src/
│   │   ├── index.ts               # Server entry point — startup, mounts, shutdown
│   │   ├── agents/                # LLM agent orchestration
│   │   │   ├── AgentOrchestrator.ts  # GoA-lite, GoA-full, GoA-MoA-hybrid execution
│   │   │   ├── AgentOrchestrator.test.ts
│   │   │   ├── RouterAgent.ts     # Model pool sampling via LLM prompt
│   │   │   ├── RouterAgent.test.ts
│   │   │   ├── moa/               # MoA aggregation prompt templates
│   │   │   │   ├── index.ts
│   │   │   │   └── agg_prompt.v1.txt
│   │   │   └── router/
│   │   │       └── prompt.v1.txt  # RouterAgent prompt template
│   │   ├── config/                # Configuration readers (port, cors, quota, timeout)
│   │   ├── db/                    # SQLite database access
│   │   │   ├── connection.ts      # Singleton db (node:sqlite, WAL)
│   │   │   ├── migrationRunner.ts # Runs ordered SQL migration files
│   │   │   ├── migrations/        # Numbered SQL migration files (001–007)
│   │   │   ├── ftsSearchService.ts # FTS5 document chunk search
│   │   │   ├── uploadedFilesRepo.ts
│   │   │   ├── policyExceptionsRepo.ts
│   │   │   └── resolveDbPath.ts
│   │   ├── dispatch/              # Request dispatch orchestration
│   │   │   ├── councilDispatch.ts # Full council mode lifecycle
│   │   │   ├── soloDispatch.ts    # Direct single-model streaming
│   │   │   └── soloFallback.ts    # Fallback dispatch (degraded mode)
│   │   ├── middleware/
│   │   │   └── rateLimit.ts       # Per-scope rate limiter factory
│   │   ├── modules/               # Cross-cutting service modules
│   │   │   ├── capabilityDetector.ts
│   │   │   ├── conversationStore.ts
│   │   │   ├── fileProcessor.ts
│   │   │   ├── modelCardSummarizer.ts
│   │   │   ├── modelPoolManager.ts  # OpenRouter free model catalog cache
│   │   │   ├── preflightGate.ts     # Policy enforcement gate
│   │   │   ├── providerHealthMonitor.ts
│   │   │   ├── retentionMonitor.ts  # Council retention rate — auto-demotion
│   │   │   ├── sessionCleanupMonitor.ts
│   │   │   ├── sessionRegistry.ts   # In-memory ownership map
│   │   │   ├── sessionStore.ts      # SQLite-backed session records
│   │   │   ├── settingsDeriver.ts
│   │   │   └── telemetryEngine.ts   # session_events writer
│   │   ├── routes/                # Express route handlers
│   │   │   ├── api.ts             # Main API router (dispatch, sessions, models, config)
│   │   │   ├── upload.ts          # File upload and FTS indexing
│   │   │   └── *.test.ts          # Co-located route integration tests
│   │   └── server/
│   │       └── gracefulShutdown.ts
│   ├── scripts/
│   │   └── run-router-eval.ts     # RouterAgent evaluation harness
│   └── package.json
├── frontend/                      # Next.js SPA (TypeScript + Tailwind)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx           # Root page — all UI state and rendering (~2000 lines)
│   │   │   ├── layout.tsx         # Next.js root layout
│   │   │   └── globals.css        # Global Tailwind CSS
│   │   ├── components/
│   │   │   ├── AgentProgressPanel.tsx  # Live agent cards during council streaming
│   │   │   ├── CouncilTrace.tsx        # Post-response council trace panel
│   │   │   └── OnboardingModal.tsx     # First-run privacy/setup modal
│   │   └── utils/
│   │       ├── api.ts             # apiClient — all backend HTTP/SSE calls
│   │       ├── api.test.ts
│   │       └── db.ts              # localDB — IndexedDB wrapper for settings
│   ├── next.config.ts
│   └── package.json
├── shared/                        # Shared TypeScript type definitions
│   ├── index.ts                   # AgentPlan, AgentResult, PreflightContext, etc.
│   └── package.json
├── tests/
│   └── eval/
│       └── moa-aggregation/       # MoA aggregation evaluation fixtures
│           ├── test-cases.json
│           └── README.md
├── scripts/
│   └── eval-moa-aggregation.ts    # Root-level evaluation script
├── docs/                          # Project documentation (markdown)
├── docs2/                         # Additional documentation
├── memory/                        # Agent dynamic session state / handoff notes
├── .planning/
│   └── codebase/                  # Codebase map documents (ARCHITECTURE.md, STRUCTURE.md, etc.)
├── .claude/
│   ├── skills/                    # Audit skill definitions
│   └── audit-runs/                # Agent audit run artifacts
├── .issues/                       # Local issue drafts
├── .worktrees/                    # Git worktrees for parallel agent work
├── .github/
│   └── ISSUE_TEMPLATE/            # GitHub issue templates
├── free_council.db                # SQLite database file (runtime, not committed)
├── package.json                   # Root-level package.json (node_modules at root)
├── CLAUDE.md                      # Anthropic Claude Code operating manual
└── AGENTS.md                      # OpenAI Codex operating manual
```

## Directory Purposes

**`backend/src/agents/`:**
- Purpose: LLM multi-agent orchestration — model selection and parallel execution
- Contains: `RouterAgent.ts`, `AgentOrchestrator.ts`, prompt templates (`.txt`)
- Key files: `AgentOrchestrator.ts` (GoA/MoA execution), `RouterAgent.ts` (agent pool sampling)

**`backend/src/config/`:**
- Purpose: Typed readers for environment-derived configuration values
- Contains: One file per config concern — port, CORS, quota, timeout, logger, OpenRouter headers
- Pattern: Each file exports a pure function, e.g., `resolvePort()`, `buildCorsOptions()`

**`backend/src/db/`:**
- Purpose: All SQLite access — connection, migrations, and repo-style query modules
- Contains: `connection.ts` (singleton), numbered migration `.sql` files, service and repo modules
- Key files: `connection.ts`, `migrationRunner.ts`, `ftsSearchService.ts`

**`backend/src/dispatch/`:**
- Purpose: Lifecycle orchestration for a single request — routing decision, preflight, agent execution, SSE output
- Contains: `councilDispatch.ts`, `soloDispatch.ts`, `soloFallback.ts`

**`backend/src/middleware/`:**
- Purpose: Reusable Express middleware
- Contains: `rateLimit.ts` (factory for scope-keyed rate limiters)

**`backend/src/modules/`:**
- Purpose: All stateful and cross-cutting backend services
- Contains: Session management, telemetry, model catalog, policy gate, file processing, background monitors
- Key files: `preflightGate.ts`, `modelPoolManager.ts`, `sessionStore.ts`, `sessionRegistry.ts`, `retentionMonitor.ts`

**`backend/src/routes/`:**
- Purpose: Express route handlers — HTTP surface
- Contains: `api.ts` (all main endpoints), `upload.ts` (file upload)
- Tests are co-located (e.g., `api.test.ts`, `api.sessionAuthz.test.ts`)

**`backend/src/server/`:**
- Purpose: Server lifecycle helpers
- Contains: `gracefulShutdown.ts`

**`frontend/src/app/`:**
- Purpose: Next.js App Router pages and layouts
- Contains: `page.tsx` (root page), `layout.tsx`, `globals.css`

**`frontend/src/components/`:**
- Purpose: React components used by `page.tsx`
- Contains: `AgentProgressPanel.tsx`, `CouncilTrace.tsx`, `OnboardingModal.tsx`

**`frontend/src/utils/`:**
- Purpose: Utility modules for API communication and browser storage
- Contains: `api.ts` (all backend calls), `db.ts` (IndexedDB wrapper)

**`shared/`:**
- Purpose: TypeScript interfaces shared between `backend` and `frontend`
- Key: `index.ts` — single file, all shared types

**`memory/`:**
- Purpose: Agent session handoff notes and dynamic learnings (NOT for durable project rules — those belong in `CLAUDE.md`)
- Generated: By agents; not code
- Committed: Yes

**`.planning/codebase/`:**
- Purpose: Codebase map documents consumed by `/gsd-plan-phase` and `/gsd-execute-phase`
- Generated: By `/gsd-map-codebase` agent
- Committed: Yes

## Key File Locations

**Entry Points:**
- `backend/src/index.ts`: Express server startup
- `frontend/src/app/page.tsx`: Next.js root page (all UI)
- `frontend/src/app/layout.tsx`: Next.js root layout

**Configuration:**
- `backend/src/config/port.ts`: Server port
- `backend/src/config/corsOptions.ts`: CORS allowed origins
- `backend/src/config/dailyQuota.ts`: API quota limit
- `backend/src/config/requestTimeout.ts`: LLM call timeout
- `frontend/next.config.ts`: Next.js build config
- `.env` / `.env.local`: Environment variables (not committed)

**Core Logic:**
- `backend/src/dispatch/councilDispatch.ts`: Council mode full lifecycle
- `backend/src/agents/AgentOrchestrator.ts`: Multi-agent execution (GoA / MoA)
- `backend/src/agents/RouterAgent.ts`: LLM-based agent pool selection
- `backend/src/modules/preflightGate.ts`: Policy enforcement
- `shared/index.ts`: Shared type contracts

**Database:**
- `backend/src/db/connection.ts`: SQLite singleton
- `backend/src/db/migrations/`: SQL migration files (`001_init.sql` → `007_sessions.sql`)
- `free_council.db`: Runtime SQLite database (root of repo, not committed)

**Testing:**
- `backend/src/**/*.test.ts`: Co-located unit/integration tests
- `frontend/src/utils/api.test.ts`: API client tests
- `tests/eval/moa-aggregation/`: MoA evaluation fixtures

## Naming Conventions

**Files:**
- Backend TypeScript modules: PascalCase for class/service files (`AgentOrchestrator.ts`, `ModelPoolManager.ts`, `SessionStore.ts`)
- Backend config files: camelCase (`corsOptions.ts`, `dailyQuota.ts`)
- Backend route files: camelCase noun (`api.ts`, `upload.ts`)
- Test files: `{source-file}.test.ts` co-located with source; route tests use dot-notation (`api.sessionAuthz.test.ts`)
- SQL migrations: `{NNN}_{snake_case_description}.sql` (zero-padded 3-digit prefix)
- Prompt templates: `{name}.v{N}.txt`
- Frontend components: PascalCase (`AgentProgressPanel.tsx`, `CouncilTrace.tsx`)
- Frontend utils: camelCase (`api.ts`, `db.ts`)

**Directories:**
- Backend source: lowercase nouns (`agents`, `config`, `db`, `dispatch`, `middleware`, `modules`, `routes`, `server`)
- Frontend: Next.js App Router conventions (`app/`, `components/`, `utils/`)

**Variables/Functions:**
- TypeScript interfaces: PascalCase (`AgentPlan`, `PreflightContext`)
- Exported constants (singleton objects): PascalCase (`SessionStore`, `TelemetryEngine`, `RetentionMonitor`)
- Functions: camelCase (`dispatchCouncilChat`, `extractBearerToken`, `resolvePort`)
- Async generators: camelCase methods on `AgentOrchestrator` object (`executeGoALite`, `executeGoAMoAHybrid`)

## Where to Add New Code

**New API endpoint:**
- Route handler: `backend/src/routes/api.ts` (append to `apiRouter`)
- For large feature areas, create `backend/src/routes/{feature}.ts` and mount in `backend/src/index.ts`
- Tests: `backend/src/routes/{feature}.test.ts` (co-located)

**New dispatch path:**
- Implementation: `backend/src/dispatch/{name}Dispatch.ts`
- Call from: `backend/src/routes/api.ts` dispatch block

**New agent execution mode:**
- Add method to `AgentOrchestrator` in `backend/src/agents/AgentOrchestrator.ts`
- Add execution mode string to `AgentPlan.executionMode` union in `shared/index.ts`
- Handle new mode in `backend/src/dispatch/councilDispatch.ts` generator selection

**New background monitor:**
- Module file: `backend/src/modules/{name}Monitor.ts`
- Start in `backend/src/index.ts` after server listen
- Register for graceful shutdown in `backend/src/server/gracefulShutdown.ts`

**New shared type:**
- Add to `shared/index.ts` (single file — all shared types live here)

**New configuration value:**
- Add reader: `backend/src/config/{valueName}.ts`
- Pattern: export a single function `getXxx()` or `resolveXxx()` that reads from `process.env`
- Add test: `backend/src/config/{valueName}.test.ts`

**New SQLite table:**
- Create: `backend/src/db/migrations/{NNN}_{description}.sql`
- Access: Add query functions to an existing repo file or create `backend/src/db/{feature}Repo.ts`

**New frontend component:**
- Implementation: `frontend/src/components/{ComponentName}.tsx`
- Import in: `frontend/src/app/page.tsx`

**New frontend utility:**
- Implementation: `frontend/src/utils/{name}.ts`

**New policy check:**
- Add `PolicyViolation` type to `shared/index.ts`
- Implement check in `backend/src/modules/preflightGate.ts`

## Special Directories

**`.planning/codebase/`:**
- Purpose: Codebase map documents for AI planning/execution agents
- Generated: Yes (by `/gsd-map-codebase`)
- Committed: Yes

**`memory/`:**
- Purpose: Dynamic agent session state and handoff notes
- Generated: Yes (by agents during task execution)
- Committed: Yes
- Constraint: Must NOT contain content already documented in `CLAUDE.md`

**`.claude/audit-runs/`:**
- Purpose: Structured output from security/architecture audit runs
- Generated: Yes (by audit agent skills)
- Committed: Yes

**`.claude/skills/`:**
- Purpose: Agent skill definitions (SKILL.md, rules/, scripts/) for specialized workflows
- Generated: No (maintained as project config)
- Committed: Yes

**`.worktrees/`:**
- Purpose: Git worktree checkouts for parallel agent issue work
- Generated: Yes (by `git worktree add`)
- Committed: No (`.git/` managed)

**`free_council.db`:**
- Purpose: SQLite runtime database
- Generated: Yes (on first server start, migrations applied automatically)
- Committed: No (excluded via `.gitignore`)

---

*Structure analysis: 2026-06-08*
