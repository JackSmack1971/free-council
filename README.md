# FreeCouncil

FreeCouncil is a local-first, single-user web chatbot built as a monorepo with three workspaces:
`frontend`, `backend`, and `shared`. The frontend is a Next.js app, the backend is an Express +
SQLite API, and `shared/index.ts` holds the TypeScript contracts used across both sides.

The application routes prompts through OpenRouter models and stores session state locally. The
frontend talks to the backend over `/api/v1`, and the backend persists its data in SQLite with a
default database file at `free_council.db`.

## Workspace Layout

- `frontend/` - Next.js UI, browser storage helpers, and client API wrapper.
- `backend/` - Express routes, dispatch logic, database access, and runtime config.
- `shared/` - Shared TypeScript interfaces for model metadata, telemetry, and gating.
- `docs/` - Project documentation.

Package-level README files live in `frontend/README.md`, `backend/README.md`, and
`shared/README.md`.

## Quick Start

Install dependencies from the repository root:

```bash
npm install
```

Run the frontend and backend together:

```bash
npm run dev
```

The default local ports are:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`

If you run the packages separately, use the package scripts in `frontend/package.json` and
`backend/package.json`.

## Useful Commands

- `npm run dev` - start both workspaces together from the root.
- `cd frontend && npm run dev` - run the Next.js UI only.
- `cd frontend && npm run build` - build the frontend.
- `cd frontend && npm run lint` - lint the frontend sources.
- `cd backend && npm run dev` - run the API server with file watching.
- `cd backend && npm run build` - type-check and compile the backend.
- `cd backend && npm test` - run the backend test suite.

## Where To Start Reading

- `backend/src/index.ts` - backend startup and route mounting.
- `backend/src/routes/api.ts` - session, dispatch, config, quota, and telemetry endpoints.
- `frontend/src/app/page.tsx` - main UI and client-side orchestration.
- `frontend/src/utils/api.ts` - browser API client used by the UI.
- `shared/index.ts` - cross-package interfaces.

