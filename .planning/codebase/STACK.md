# Technology Stack

**Analysis Date:** 2026-06-08

## Languages

**Primary:**
- TypeScript 5.x - All backend source (`backend/src/**/*.ts`) and frontend source (`frontend/src/**/*.ts`, `frontend/src/**/*.tsx`)

**Secondary:**
- SQL - SQLite migration scripts (`backend/src/db/migrations/*.sql`)
- CSS - Global styles (`frontend/src/app/globals.css`)

## Runtime

**Environment:**
- Node.js (backend) — ES module format (`"type": "module"` in `backend/package.json`), targeting ES2022
- Browser (frontend) — React 19 / Next.js 16 app running in browser DOM

**Package Manager:**
- npm with workspaces
- Lockfile: `package-lock.json` present at repo root

## Frameworks

**Core:**
- Express 4.19.2 (`backend/package.json`) - HTTP server, REST API, SSE streaming
- Next.js 16.2.6 (`frontend/package.json`) - React full-stack framework, App Router
- React 19.2.4 (`frontend/package.json`) - UI component library

**Testing:**
- Node.js built-in test runner (`node --import tsx --test`) — used in backend (`backend/package.json` scripts)
- No separate test framework package detected

**Build/Dev:**
- tsx 4.7.2 (`backend/package.json`) - TypeScript execution for dev and test
- nodemon 3.1.0 (`backend/package.json`) - File watching and auto-restart in dev
- tsc (TypeScript compiler) - Production build for backend, `outDir: ./dist`
- Next.js build toolchain - Frontend production builds (`next build`)
- concurrently 8.2.2 (`package.json`) - Runs frontend and backend dev servers in parallel

## Key Dependencies

**Critical:**
- `pdf-parse` 2.4.5 (`backend/package.json`) - PDF file extraction for uploaded documents
- `cors` 2.8.5 (`backend/package.json`) - CORS middleware with origin allowlist
- `dotenv` 16.4.5 (`backend/package.json`) - Environment variable loading
- `shared` workspace (`*`) - Internal shared types package at `shared/index.ts`

**Infrastructure:**
- `node:sqlite` (Node.js built-in, no separate package) — SQLite database via `DatabaseSync` in `backend/src/db/connection.ts`
- `node:crypto` (Node.js built-in) — Session ID generation in `backend/src/routes/api.ts`

## Configuration

**Environment:**
- Configured via `.env` file (see `.env.example` at repo root)
- Key env vars:
  - `PORT` — Backend listen port (default resolved in `backend/src/config/port.ts`)
  - `DATABASE_PATH` — SQLite file path (default `./free_council.db`)
  - `CORS_ORIGINS` — Comma-separated allowed origins (default `http://localhost:3000`)
  - `FRONTEND_URL` — Used as `HTTP-Referer` header on OpenRouter requests
  - `DAILY_API_QUOTA` — Max daily API requests (configured in `backend/src/config/dailyQuota.ts`)
  - `LOG_LEVEL` — Logging verbosity (configured in `backend/src/config/logger.ts`)
  - `REQUEST_TIMEOUT_MS` — Timeout for outbound AI requests (configured in `backend/src/config/requestTimeout.ts`)
  - `NEXT_PUBLIC_API_URL` — Frontend env var pointing to backend (`http://localhost:3001/api/v1`)
- No `.env` file is checked into the repository; only `.env.example` is present

**Build:**
- `backend/tsconfig.json` — TypeScript compiler config for backend (`target: ES2022`, `module: NodeNext`)
- `frontend/tsconfig.json` — TypeScript config for Next.js (`target: ES2017`, `module: esnext`, paths alias `@/*` → `./src/*`)
- `frontend/next.config.ts` — Next.js configuration (minimal, no custom options)
- `frontend/postcss.config.mjs` — PostCSS for Tailwind CSS
- `frontend/eslint.config.mjs` — ESLint config (Next.js preset)

## Platform Requirements

**Development:**
- Node.js with npm workspaces support
- Run both services: `npm run dev` from repo root (uses `concurrently`)
- Backend dev: `npm run dev --workspace=backend` → `nodemon` + `tsx`
- Frontend dev: `npm run dev --workspace=frontend` → `next dev`

**Production:**
- Backend: compile with `tsc`, run `node dist/index.js`
- Frontend: `next build` then `next start`
- SQLite database file persists at `DATABASE_PATH` (defaults to `./free_council.db` at repo root)
- No containerization config detected (no Dockerfile, docker-compose)

---

*Stack analysis: 2026-06-08*
