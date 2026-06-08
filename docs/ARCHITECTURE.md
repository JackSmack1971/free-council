# Architecture

## Overview

FreeCouncil is split into three workspaces:

- `frontend/` - the Next.js user interface.
- `backend/` - the Express API, dispatch engine, and SQLite persistence layer.
- `shared/` - TypeScript interfaces consumed by both packages.

The application is designed to stay local-first. The frontend owns browser state and sends API
requests to the backend. The backend owns session state, telemetry, routing, and database writes.

## Runtime Flow

1. `backend/src/index.ts` starts Express, installs CORS and JSON parsing, runs database migrations,
   refreshes the model catalog, then starts the retention and session cleanup monitors.
2. The frontend loads `frontend/src/app/page.tsx`, initializes browser storage, fetches config,
   quota, sessions, and model metadata, then drives the chat experience.
3. User prompts are sent through `frontend/src/utils/api.ts` to backend endpoints under `/api/v1`.
4. The backend dispatch layer streams SSE responses back to the frontend and persists conversation
   history in SQLite.

## Backend Layers

- `backend/src/config/` - environment-driven settings such as port, timeouts, logging, CORS, and
  daily quota limits.
- `backend/src/db/` - SQLite connection, migration runner, FTS search, and repository helpers.
- `backend/src/modules/` - business logic for model metadata, preflight gating, telemetry, session
  state, uploads, retention, and settings derivation.
- `backend/src/agents/` - routing and orchestration logic for model selection and aggregation.
- `backend/src/dispatch/` - solo and council dispatch flows.
- `backend/src/routes/` - HTTP endpoints for sessions, models, dispatch, config, quota, uploads,
  schema validation, and diagnostics.
- `backend/src/server/` - graceful shutdown handling.

The backend keeps both SQLite-backed state and in-memory session ownership state. Session records
are created in the store and tracked in `SessionRegistry` for ownership checks and per-session
operations.

## Frontend Layers

- `frontend/src/app/` - App Router entrypoints and page shell.
- `frontend/src/components/` - UI panels for council trace, agent progress, and onboarding.
- `frontend/src/utils/api.ts` - browser API client and API base resolution.
- `frontend/src/utils/db.ts` - IndexedDB-backed local storage with localStorage fallback.

The UI stores user preferences locally in the browser and keeps API keys session-only.

## Shared Contract

`shared/index.ts` defines the cross-package types for:

- normalized model capabilities
- UI control specs
- session telemetry events
- agent plans and results
- preflight gating inputs and results

Keeping these interfaces in one place avoids drift between the frontend and backend.

## Data and Storage

- Default SQLite database: `free_council.db`
- Override path: `DATABASE_PATH`
- WAL mode and busy timeout are enabled in `backend/src/db/connection.ts`
- SQL migrations live in `backend/src/db/migrations/`
- Uploaded document text is indexed with FTS5
- Session config values are stored in the `app_config` table

## Request Surface

The main API surface is defined in `backend/src/routes/api.ts` and includes:

- session creation and listing
- model metadata lookup
- dispatch streaming
- quota reporting
- session message retrieval
- config read/write
- telemetry events
- JSON schema validation
- retention-rate diagnostics

File uploads are handled separately in `backend/src/routes/upload.ts`.

