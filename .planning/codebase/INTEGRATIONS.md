# External Integrations

**Analysis Date:** 2026-06-08

## APIs & External Services

**AI / LLM Gateway:**
- OpenRouter — All AI model inference is routed through OpenRouter's API
  - Endpoint: `https://openrouter.ai/api/v1/chat/completions` (called from `backend/src/agents/AgentOrchestrator.ts`, `backend/src/agents/RouterAgent.ts`, `backend/src/dispatch/soloDispatch.ts`, `backend/src/dispatch/soloFallback.ts`)
  - Model catalog: `https://openrouter.ai/api/v1/models` (called from `backend/src/modules/modelPoolManager.ts`)
  - Auth: Bearer token — the API key is passed per-request from the client through the backend; it is NOT stored server-side as an env var. Clients supply their own OpenRouter API key.
  - Headers: `HTTP-Referer` set to `FRONTEND_URL` env var via `backend/src/config/openRouterHeaders.ts`
  - SDK/Client: Native `fetch` (no SDK)

**Google Fonts:**
- Geist / Geist Mono fonts loaded via `next/font/google` in `frontend/src/app/layout.tsx`
  - This is a build-time/runtime fetch to Google's font CDN; no API key required

## Data Storage

**Databases:**
- SQLite (local file)
  - Connection: `DATABASE_PATH` env var (default `./free_council.db`)
  - Client: Node.js built-in `DatabaseSync` from `node:sqlite` module
  - Implementation: `backend/src/db/connection.ts`
  - WAL journal mode enabled; busy timeout 5000ms
  - Schema managed via sequential migration files in `backend/src/db/migrations/`
    - `001_init.sql` — initial schema
    - `002_session_events.sql`
    - `003_policy_exceptions.sql`
    - `004_app_config.sql`
    - `005_uploaded_files.sql`
    - `006_file_chunks_fts.sql` — full-text search
    - `007_sessions.sql`

**File Storage:**
- Local filesystem only — uploaded files are stored locally; handled by `backend/src/routes/upload.ts` and `backend/src/db/uploadedFilesRepo.ts`

**Caching:**
- In-memory only — proposer response cache in `backend/src/agents/AgentOrchestrator.ts` (keyed by modelId + prompt hash, scoped per session)
- SQLite model snapshot cache — `model_snapshots` table used as fallback when OpenRouter is unreachable (`backend/src/modules/modelPoolManager.ts`)

## Authentication & Identity

**Auth Provider:**
- No third-party auth provider detected
- Session-based identity: sessions created server-side, stored in SQLite `sessions` table via `backend/src/modules/sessionStore.ts` and `backend/src/modules/sessionRegistry.ts`
- API key auth: clients pass their OpenRouter API key as a Bearer token in the `Authorization` header on each request; the backend extracts it via `extractBearerToken` in `backend/src/modules/sessionRegistry.ts` and forwards it to OpenRouter
- Session authorization enforced in `backend/src/routes/api.ts` and `backend/src/routes/api.sessionAuthz.test.ts`

## Monitoring & Observability

**Error Tracking:**
- No external error tracking service detected (no Sentry, Datadog, etc.)

**Logs:**
- Custom console logging configured via `backend/src/config/logger.ts`
- Log level controlled by `LOG_LEVEL` env var
- Structured console output with `[Component]` prefix convention throughout backend source
- Telemetry events recorded internally to SQLite `session_events` table via `backend/src/modules/telemetryEngine.ts`

## CI/CD & Deployment

**Hosting:**
- No deployment platform config detected (no Vercel config, Railway config, Fly.toml, Heroku Procfile, or Dockerfile)

**CI Pipeline:**
- No CI config detected (no `.github/workflows/`, no CircleCI, no GitLab CI)

## Environment Configuration

**Required env vars:**
- `PORT` — backend listen port (optional; has default)
- `DATABASE_PATH` — SQLite file path (optional; defaults to `./free_council.db`)
- `CORS_ORIGINS` — comma-separated allowed CORS origins (optional; defaults to `http://localhost:3000`)
- `FRONTEND_URL` — forwarded as `HTTP-Referer` to OpenRouter (optional; has fallback)
- `DAILY_API_QUOTA` — daily request quota ceiling (optional; has default)
- `LOG_LEVEL` — logging verbosity (optional; has default)
- `REQUEST_TIMEOUT_MS` — outbound request timeout (optional; has default)
- `NEXT_PUBLIC_API_URL` — frontend env var for backend base URL (required for frontend to reach backend)

**No server-side AI API key is configured** — each client session supplies its own OpenRouter key at runtime.

**Secrets location:**
- No server-side secrets stored; client-provided OpenRouter API key is ephemeral per request
- `.env` file at repo root (not committed); template at `.env.example`

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- All outbound calls are synchronous fetch requests to `https://openrouter.ai/api/v1/*`
- Responses are streamed back to clients via Server-Sent Events (SSE) from `backend/src/routes/api.ts`

---

*Integration audit: 2026-06-08*
