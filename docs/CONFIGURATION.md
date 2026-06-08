# Configuration

## Runtime Environment Variables

| Variable | Scope | Default | Purpose |
|---|---|---:|---|
| `PORT` | backend | `3001` | Backend listen port |
| `DATABASE_PATH` | backend | `free_council.db` | SQLite database path override |
| `REQUEST_TIMEOUT_MS` | backend | `30000` | Backend request timeout |
| `DAILY_API_QUOTA` | backend | `200` | Daily quota value reported by `/api/v1/quota` |
| `LOG_LEVEL` | backend | `info` | Console logging verbosity |
| `FRONTEND_URL` | backend | `http://localhost:3000` | Referer value used for OpenRouter requests |
| `CORS_ORIGINS` | backend | `http://localhost:3000` | Allowed CORS origins |
| `NEXT_PUBLIC_API_URL` | frontend | `http://localhost:3001/api/v1` in dev, `/api/v1` in prod | Backend API base URL |

## Backend Settings

The backend also stores configuration values in SQLite `app_config` through `/api/v1/config`.
Observed keys include:

- `default_mode`
- `demoted_by_retention`
- `council_reevaluated_after_ts`

Those values are read by the frontend to decide whether to show the Council Mode rollback banner
and what default routing mode to use.

## Browser-Persisted Settings

The frontend stores user preferences locally in IndexedDB with a localStorage fallback. Observed
keys include:

- `onboarding_complete`
- `free_lock_enabled`
- `selected_model_id`
- `dispatch_mode`
- `reasoning_effort`
- `zdr_required`
- `structured_output_enabled`
- `json_schema_text`
- `custom_presets`

API keys are not persisted in browser storage by design.

## Database Defaults

- Default database file: `free_council.db`
- SQLite uses WAL mode and a 5 second busy timeout
- Migrations live in `backend/src/db/migrations/`

## Where Config Is Consumed

- Backend startup and route mounting: `backend/src/index.ts`
- CORS origin handling: `backend/src/config/corsOptions.ts`
- Port resolution: `backend/src/config/port.ts`
- Request timeout: `backend/src/config/requestTimeout.ts`
- Quota reporting: `backend/src/config/dailyQuota.ts`
- Frontend API base resolution: `frontend/src/utils/api.ts`

