# Getting Started

## Prerequisites

- Node.js 22 or newer is recommended.
- npm is used for dependency installation and scripts.

## Install

From the repository root:

```bash
npm install
```

The repository uses npm workspaces, so this installs dependencies for `frontend`, `backend`, and
`shared`.

## Run Locally

Start both services from the root:

```bash
npm run dev
```

That runs:

- the Next.js frontend on `http://localhost:3000`
- the Express backend on `http://localhost:3001`

If you prefer to run them separately:

```bash
cd frontend && npm run dev
cd backend && npm run dev
```

## First-Run Behavior

- The frontend opens on the main chat screen.
- Browser state is stored locally in IndexedDB, with localStorage fallback.
- API keys are treated as session-only browser state.
- The backend loads migrations and refreshes the model catalog on startup.

## Environment Variables

The backend reads these environment variables:

- `PORT` - backend listen port, default `3001`
- `DATABASE_PATH` - SQLite file path override
- `REQUEST_TIMEOUT_MS` - backend request timeout override
- `DAILY_API_QUOTA` - daily quota limit used by the quota endpoint
- `LOG_LEVEL` - console logging filter
- `FRONTEND_URL` - referer value used for OpenRouter requests
- `CORS_ORIGINS` - comma-separated list of allowed frontend origins

The frontend reads:

- `NEXT_PUBLIC_API_URL` - backend API base URL

If `NEXT_PUBLIC_API_URL` is not set, the frontend uses `http://localhost:3001/api/v1` in
development and `/api/v1` in production.

## Useful Entry Points

- `backend/src/index.ts`
- `frontend/src/app/page.tsx`
- `frontend/src/utils/api.ts`
- `backend/src/routes/api.ts`

