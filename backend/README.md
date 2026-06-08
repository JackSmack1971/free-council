# Backend

This package contains the Express API, SQLite persistence layer, routing logic, and dispatch
orchestration for FreeCouncil.

## What It Does

- Serves the `/api/v1` HTTP surface.
- Runs SQLite migrations and manages the local database file.
- Streams solo and council dispatch responses.
- Stores conversations, telemetry, sessions, uploads, and config state.
- Enforces request gates and ownership checks around sensitive actions.

## Key Files

- `src/index.ts` - server bootstrap and route mounting.
- `src/routes/api.ts` - main API routes.
- `src/routes/upload.ts` - upload flow.
- `src/db/` - database connection, migrations, and repositories.
- `src/modules/` - state managers and business logic.
- `src/agents/` - routing and aggregation logic.
- `src/dispatch/` - solo and council execution paths.

## Scripts

- `npm run dev` - run the backend with file watching.
- `npm run build` - type-check and compile the backend.
- `npm start` - run the compiled backend.
- `npm test` - run the backend tests.
- `npm run eval-router` - run the router evaluation script.

## Configuration

Useful environment variables:

- `PORT`
- `DATABASE_PATH`
- `REQUEST_TIMEOUT_MS`
- `DAILY_API_QUOTA`
- `LOG_LEVEL`
- `FRONTEND_URL`
- `CORS_ORIGINS`

## Testing

Tests live next to the code they cover as `*.test.ts`. The suite uses Node's built-in test runner,
so behavior changes should usually come with colocated tests in the affected module, route, or
dispatch directory.

