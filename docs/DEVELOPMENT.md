# Development

## Repository Layout

- `frontend/` - UI and browser-side orchestration
- `backend/` - API server, dispatch logic, persistence, and telemetry
- `shared/` - shared TypeScript contracts

## Code Boundaries

Keep cross-boundary data shapes in `shared/index.ts`. When a request payload, response shape, or
telemetry field changes, update the shared types before wiring the callers.

Backend code is organized by concern:

- `src/routes/` - HTTP handlers
- `src/dispatch/` - solo and council streaming flows
- `src/agents/` - model routing and aggregation logic
- `src/modules/` - business logic and state managers
- `src/db/` - SQLite access and migrations
- `src/config/` - environment-driven settings
- `src/server/` - shutdown behavior

Frontend code is organized by concern:

- `src/app/` - App Router shell and page entrypoints
- `src/components/` - reusable UI panels
- `src/utils/` - API client and browser persistence helpers

## Editing Rules

- Prefer small changes that keep API contracts stable.
- Update colocated tests when behavior changes.
- Keep imports aligned with the existing TypeScript/ESM style.
- Avoid introducing new state duplication between browser storage, SQLite, and in-memory caches
  unless there is a clear ownership reason.

## Local State

The frontend persists preferences in browser storage through `frontend/src/utils/db.ts`. The backend
persists operational data in SQLite and keeps session ownership information in both SQLite-backed
tables and `SessionRegistry`.

## Build and Check Workflow

- `cd frontend && npm run build` to catch frontend compile issues.
- `cd frontend && npm run lint` to check UI code style.
- `cd backend && npm run build` to type-check the backend.
- `cd backend && npm test` to run backend tests.

## Good Places To Start

- UI behavior: `frontend/src/app/page.tsx`
- API behavior: `backend/src/routes/api.ts`
- Upload flow: `backend/src/routes/upload.ts`
- Routing logic: `backend/src/agents/`
- Model metadata handling: `backend/src/modules/modelPoolManager.ts`

